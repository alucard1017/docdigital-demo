const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendSigningInvitation, sendVisadoInvitation } = require('../services/emailService');
const { uploadPdfToS3, getSignedUrl } = require('../services/s3');
const { isValidEmail, isValidRun, validateLength } = require('../utils/validators');
const { PDFDocument, rgb, degrees } = require('pdf-lib'); // 👈 NUEVO

console.log('DEBUG START >> documents.js cargado en Render');

const router = express.Router();

/* ================================
   FUNCION: APLICAR MARCA DE AGUA
   ================================ */
async function aplicarMarcaAguaLocal(filePath) {
  try {
    const bytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    const texto = 'VERIFIRMA - COPIA';
    const fontSize = 18;        // más pequeño para repetir
    const opacity = 0.25;       // más suave
    const angle = 30;           // diagonal
    const xStep = 180;          // separación horizontal
    const yStep = 160;          // separación vertical

    for (const page of pages) {
      const { width, height } = page.getSize();

      for (let x = -width; x < width * 2; x += xStep) {
        for (let y = -height; y < height * 2; y += yStep) {
          page.drawText(texto, {
            x,
            y,
            size: fontSize,
            color: rgb(0.8, 0.8, 0.8),
            rotate: degrees(angle),
            opacity,
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(filePath, pdfBytes);
    console.log('✅ Marca de agua en patrón repetido aplicada a', filePath);
  } catch (err) {
    console.error('⚠️ Error aplicando marca de agua:', err);
  }
}

/* ================================
   CONFIGURACIÓN MULTER (temporal)
   ================================ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads/temporal');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'El archivo supera el tamaño máximo permitido (25 MB).',
    });
  }
  if (err.message === 'Solo se permiten archivos PDF') {
    return res
      .status(400)
      .json({ message: 'Solo se permiten archivos PDF' });
  }
  return next(err);
}

/* ================================
   GET: Listar documentos del usuario
   ================================ */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { sort } = req.query;
    let orderByClause = 'title ASC, id ASC';

    if (sort === 'fecha_desc') orderByClause = 'created_at DESC';
    if (sort === 'fecha_asc') orderByClause = 'created_at ASC';

    const result = await db.query(
      `SELECT 
         id, owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, signature_status, requires_visado, reject_reason,
         tipo_tramite, requiere_firma_notarial, created_at, updated_at 
       FROM documents 
       WHERE owner_id = $1 
       ORDER BY ${orderByClause}`,
      [req.user.id]
    );

    const docs = result.rows.map((row) => ({
      ...row,
      requiresVisado: row.requires_visado === true,
      file_url: row.file_path,
    }));

    res.json(docs);
  } catch (err) {
    console.error('❌ Error listando documentos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Crear nuevo documento / trámite
   ================================ */
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      console.log('DEBUG DOCS >> POST /api/docs recibido');
      console.log('DEBUG BODY >>', {
        title: req.body.title,
        destinatario_email: req.body.destinatario_email,
        firmante_email: req.body.firmante_email,
        visador_email: req.body.visador_email,
        requiresVisado: req.body.requiresVisado,
        tipoTramite: req.body.tipoTramite,
        requiere_firma_notarial: req.body.requiere_firma_notarial,
      });

      const {
        title,
        description,
        destinatario_nombre,
        destinatario_email,
        destinatario_movil,
        visador_nombre,
        visador_email,
        visador_movil,
        firmante_nombre_completo,
        firmante_email,
        firmante_movil,
        firmante_run,
        empresa_rut,
        requiresVisado,
        firmante_adicional_nombre_completo,
        firmante_adicional_email,
        firmante_adicional_movil,
        tipoTramite,
        requiere_firma_notarial,
      } = req.body;

      // Normalizar tipo_tramite y flag notarial
      const tipo_tramite =
        tipoTramite === 'notaria' ? 'notaria' : 'propio';
      const requiereNotaria =
        requiere_firma_notarial === 'true' ||
        requiere_firma_notarial === true;

      if (!req.file) {
        return res
          .status(400)
          .json({ message: 'El archivo PDF es obligatorio' });
      }

      if (
        !title ||
        !firmante_nombre_completo ||
        !firmante_email ||
        !firmante_run ||
        !destinatario_nombre ||
        !destinatario_email ||
        !empresa_rut
      ) {
        return res
          .status(400)
          .json({ message: 'Faltan campos obligatorios' });
      }

      if (!isValidEmail(firmante_email)) {
        return res
          .status(400)
          .json({ message: 'Email del firmante inválido' });
      }

      if (!isValidEmail(destinatario_email)) {
        return res
          .status(400)
          .json({ message: 'Email del destinatario inválido' });
      }

      if (visador_email && !isValidEmail(visador_email)) {
        return res
          .status(400)
          .json({ message: 'Email del visador inválido' });
      }

      if (firmante_adicional_email && !isValidEmail(firmante_adicional_email)) {
        return res
          .status(400)
          .json({ message: 'Email del firmante adicional inválido' });
      }

      console.log('DEBUG RUN ORIGINAL:', firmante_run, typeof firmante_run);
      const runValue = Array.isArray(firmante_run)
        ? firmante_run[0]
        : firmante_run;
      console.log('DEBUG RUN NORMALIZADO:', runValue, typeof runValue);

      if (!isValidRun(runValue)) {
        return res.status(400).json({
          message: 'RUN del firmante inválido (ej: 12.345.678-9)',
        });
      }

      try {
        validateLength(title, 5, 200, 'Título');
        validateLength(
          firmante_nombre_completo,
          3,
          100,
          'Nombre del firmante'
        );
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }

      // 👇 NUEVO: aplicar marca de agua antes de subir
      await aplicarMarcaAguaLocal(req.file.path);

      // Subir PDF a S3
      let s3Key = null;

      try {
        s3Key = `documentos/${req.user.id}/${Date.now()}-${req.file.originalname}`;
        await uploadPdfToS3(req.file.path, s3Key);
        console.log(`✅ Archivo subido a S3: ${s3Key}`);
      } catch (s3Error) {
        console.error('⚠️ Error subiendo a S3:', s3Error.message);
        return res
          .status(500)
          .json({ message: 'No se pudo subir el archivo a S3' });
      } finally {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, (err) => {
            if (err) {
              console.error('⚠️ Error eliminando archivo temporal:', err);
            }
          });
        }
      }

      // Token principal (firmante “dueño”)
      const signatureToken = crypto.randomUUID();
      const signatureExpiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );
      const requires_visado = requiresVisado === 'true';

      // INSERT en documents
      const result = await db.query(
  	`INSERT INTO documents (
     	  owner_id, title, description, file_path, status,
     	  destinatario_nombre, destinatario_email, destinatario_movil,
     	  visador_nombre, visador_email, visador_movil,
     	  firmante_nombre, firmante_email, firmante_movil, firmante_run,
     	  empresa_rut, requires_visado, signature_token,
     	  signature_token_expires_at, signature_status,
     	  tipo_tramite, estado, pdf_original_url, pdf_final_url, requiere_firma_notarial,
     	  created_at, updated_at
   	 ) VALUES (
    	  $1, $2, $3, $4, $5,
     	  $6, $7, $8,
     	  $9, $10, $11,
     	  $12, $13, $14, $15,
     	  $16, $17, $18, $19,
     	  $20,
     	  $21, $22, $23, $24, $25,
     	  NOW(), NOW()
   	)
   	RETURNING *`,
        [
          req.user.id,
          title,
          description,
          s3Key,
          'PENDIENTE',
          destinatario_nombre,
          destinatario_email,
          destinatario_movil,
          visador_nombre,
          visador_email,
          visador_movil,
          firmante_nombre_completo,
          firmante_email,
          firmante_movil,
          runValue,
          empresa_rut,
          requires_visado,
          signatureToken,
          signatureExpiresAt,
          'PENDIENTE',
          tipo_tramite,
          'borrador',
          s3Key,
          null,
          requiereNotaria,
        ]
      );

      const doc = result.rows[0];

      // Audit trail
      await db.query(
        `INSERT INTO document_events (
           document_id, actor, action, details, from_status, to_status,
           tipo_evento, detalle, ip, user_agent
         ) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          doc.id,
          req.user.name || 'Sistema',
          'CREADO',
          `Documento "${title}" creado`,
          null,
          'PENDIENTE',
          'DOCUMENTO_CREADO',
          JSON.stringify({
            titulo: title,
            creadoPor: req.user.id,
            tipo_tramite,
          }),
          req.ip,
          req.headers['user-agent'] || null,
        ]
      );

      const frontBaseUrl =
        process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';

      console.log(
        'DEBUG DOC EMAILS >> requires_visado:',
        requires_visado,
        'visador_email:',
        visador_email,
        'destinatario_email:',
        destinatario_email
      );

      // ENCOLAR EMAILS EN BACKGROUND
      try {
        if (firmante_email) {
          sendSigningInvitation(
            firmante_email,
            title,
            `${frontBaseUrl}/firma-publica?token=${signatureToken}`
          ).catch((err) => {
            console.error('❌ Error encolando email de firma:', err.message);
          });
        }

        if (firmante_adicional_email) {
          const tokenFirmanteAdicional = crypto.randomUUID();
          console.log(
            '📧 Encolando email para firmante adicional:',
            firmante_adicional_email
          );
          sendSigningInvitation(
            firmante_adicional_email,
            title,
            `${frontBaseUrl}/firma-publica?token=${tokenFirmanteAdicional}`
          ).catch((err) => {
            console.error(
              '❌ Error encolando email de firmante adicional:',
              err.message
            );
          });
        }

        if (requires_visado && visador_email) {
          const tokenVisador = crypto.randomUUID();
          console.log('📧 Encolando email para visador:', visador_email);
          sendVisadoInvitation(
            visador_email,
            title,
            `${frontBaseUrl}/firma-publica?token=${tokenVisador}&mode=visado`
          ).catch((err) => {
            console.error('❌ Error encolando email de visado:', err.message);
          });
        }

        if (destinatario_email && destinatario_email !== firmante_email) {
          console.log(
            '📧 Encolando notificación a destinatario/empresa:',
            destinatario_email
          );
          sendSigningInvitation(
            destinatario_email,
            title,
            `${frontBaseUrl}/documentos/${doc.id}`
          ).catch((err) => {
            console.error(
              '❌ Error encolando email de destinatario:',
              err.message
            );
          });
        }
      } catch (emailError) {
        console.error('⚠️ Error al encolar emails:', emailError.message);
      }

      return res.status(201).json({
        ...doc,
        requiresVisado: doc.requires_visado === true,
        file_url: doc.file_path,
        message:
          'Documento creado exitosamente. Los emails se enviarán en segundo plano.',
      });
    } catch (err) {
      console.error('❌ Error creando documento:', err);
      return res
        .status(500)
        .json({ message: 'Error interno del servidor' });
    }
  }
);

/* ==== resto de rutas (GET /:id/pdf, timeline, firmar, visar, rechazar, download) igual que ya tenías ==== */
// 👉 Deja sin cambios todo lo que sigue a partir de router.get('/:id/pdf', ...)

module.exports = router;
