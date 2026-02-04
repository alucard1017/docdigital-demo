// backend/routes/documents.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendSignatureInviteEmail } = require('../services/sendSignatureInviteEmail');
const { uploadPdfToS3, getSignedUrl } = require('../services/s3');
const { isValidEmail, isValidRun, validateLength } = require('../utils/validators');

console.log('DEBUG START >> documents.js cargado en Render');

const router = express.Router();

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
         created_at, updated_at 
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

    return res.json(docs);
  } catch (err) {
    console.error('❌ Error listando documentos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Crear nuevo documento
   ================================ */
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
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

        // OPCIONALES: firmante adicional
        firmante_adicional_nombre_completo,
        firmante_adicional_email,
        firmante_adicional_movil,
      } = req.body;

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

      const result = await db.query(
        `INSERT INTO documents (
           owner_id, title, description, file_path, status,
           destinatario_nombre, destinatario_email, destinatario_movil,
           visador_nombre, visador_email, visador_movil,
           firmante_nombre, firmante_email, firmante_movil, firmante_run,
           empresa_rut, requires_visado, signature_token,
           signature_token_expires_at, signature_status,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17, $18, $19,
           $20, NOW(), NOW()
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
        ]
      );

      const doc = result.rows[0];

      await db.query(
        `INSERT INTO document_events (
           document_id, actor, action, details, from_status, to_status
         ) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          doc.id,
          req.user.name || 'Sistema',
          'CREADO',
          `Documento "${title}" creado`,
          null,
          'PENDIENTE',
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

      // 1) Firmante principal
      await sendSignatureInviteEmail({
        signer_email: firmante_email,
        signer_name: firmante_nombre_completo,
        document_title: title,
        sign_url: `${frontBaseUrl}/firma-publica?token=${signatureToken}`,
      });

      // 2) Firmante adicional (si existe)
      if (firmante_adicional_email) {
        const tokenFirmanteAdicional = crypto.randomUUID();

        console.log(
          '📧 Enviando invitación a firmante adicional:',
          firmante_adicional_email
        );

        await sendSignatureInviteEmail({
          signer_email: firmante_adicional_email,
          signer_name:
            firmante_adicional_nombre_completo || 'Firmante adicional',
          document_title: title,
          sign_url: `${frontBaseUrl}/firma-publica?token=${tokenFirmanteAdicional}`,
        });
      }

      // 3) Visador (si el documento requiere visado y hay email)
      if (requires_visado && visador_email) {
        const tokenVisador = crypto.randomUUID();

        console.log('📧 Enviando invitación a visador:', visador_email);

        await sendSignatureInviteEmail({
          signer_email: visador_email,
          signer_name: visador_nombre || 'Visador',
          document_title: title,
          sign_url: `${frontBaseUrl}/firma-publica?token=${tokenVisador}&mode=visado`,
        });
      }

      // 4) Empresa / destinatario (solo notificación)
      if (destinatario_email) {
        console.log(
          '📧 Enviando notificación a destinatario/empresa:',
          destinatario_email
        );

        await sendSignatureInviteEmail({
          signer_email: destinatario_email,
          signer_name: destinatario_nombre || 'Destinatario',
          document_title: title,
          sign_url: `${frontBaseUrl}`,
        });
      }

      return res.status(201).json({
        ...doc,
        requiresVisado: doc.requires_visado === true,
        file_url: doc.file_path,
        message: 'Documento creado y subido a S3',
      });
    } catch (err) {
      console.error('❌ Error creando documento:', err);
      return res
        .status(500)
        .json({ message: 'Error interno del servidor' });
    }
  }
);

/* ================================
   GET: URL firmada solo para VER PDF
   ================================ */
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT file_path
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const { file_path } = result.rows[0];

    if (!file_path) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    const signedUrl = await getSignedUrl(file_path, 3600);
    return res.json({ url: signedUrl });
  } catch (err) {
    console.error('❌ Error obteniendo PDF:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   GET: Timeline del documento
   ================================ */
router.get('/:id/timeline', async (req, res) => {
  try {
    const docId = req.params.id;

    const docRes = await db.query(
      `SELECT 
         id, title, status, destinatario_nombre,
         empresa_rut, created_at, updated_at,
         requires_visado, firmante_nombre, visador_nombre 
       FROM documents 
       WHERE id = $1`,
      [docId]
    );

    if (docRes.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const doc = docRes.rows[0];

    const eventsRes = await db.query(
      `SELECT 
         id, action, details, actor, from_status, to_status, created_at 
       FROM document_events 
       WHERE document_id = $1 
       ORDER BY created_at ASC`,
      [docId]
    );

    const events = eventsRes.rows;

    let currentStep = 'Pendiente';
    let nextStep = '';
    let progress = 0;

    if (doc.status === 'PENDIENTE') {
      if (doc.requires_visado) {
        nextStep = '⏳ Esperando visación';
        progress = 25;
      } else {
        nextStep = '⏳ Esperando firma';
        progress = 50;
      }
    } else if (doc.status === 'VISADO') {
      currentStep = 'Visado';
      nextStep = '⏳ Esperando firma';
      progress = 75;
    } else if (doc.status === 'FIRMADO') {
      currentStep = 'Firmado';
      nextStep = '✅ Completado';
      progress = 100;
    } else if (doc.status === 'RECHAZADO') {
      currentStep = 'Rechazado';
      nextStep = '❌ Rechazado';
      progress = 0;
    }

    const formattedEvents = events.map((evt) => ({
      id: evt.id,
      action: evt.action,
      details: evt.details,
      actor: evt.actor,
      timestamp: evt.created_at,
      fromStatus: evt.from_status,
      toStatus: evt.to_status,
    }));

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        requires_visado: doc.requires_visado,
      },
      timeline: {
        currentStep,
        nextStep,
        progress,
        events: formattedEvents,
      },
    });
  } catch (err) {
    console.error('❌ Error obteniendo timeline:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
router.post('/:id/firmar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({ message: 'Ya firmado' });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({ message: 'Documento rechazado' });
    }

    if (docActual.requires_visado === true && docActual.status === 'PENDIENTE') {
      return res.status(400).json({
        message: 'Este documento requiere visación antes de firmar',
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      ['FIRMADO', id, req.user.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || 'Sistema',
        'FIRMADO',
        'Firmado',
        docActual.status,
        'FIRMADO',
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento firmado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error firmando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Visar documento
   ================================ */
router.post('/:id/visar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({ message: 'Ya firmado' });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({ message: 'Documento rechazado' });
    }

    if (docActual.requires_visado !== true) {
      return res.status(400).json({
        message: 'Este documento no requiere visación',
      });
    }

    if (docActual.status !== 'PENDIENTE') {
      return res.status(400).json({
        message: 'Solo se pueden visar documentos en estado PENDIENTE',
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING *`,
      ['VISADO', id, req.user.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       ) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || 'Sistema',
        'VISADO',
        'Documento visado por el propietario',
        docActual.status,
        'VISADO',
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento visado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error visando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
 * POST: Rechazar documento
 * ================================ */
router.post('/:id/rechazar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { motivo } = req.body;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({
        message: 'Ya firmado, no se puede rechazar',
      });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({ message: 'Ya rechazado' });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, reject_reason = $2, updated_at = NOW()
       WHERE id = $3 AND owner_id = $4 
       RETURNING *`,
      ['RECHAZADO', motivo || 'Sin especificar', id, req.user.id]
    );

    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       ) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || 'Sistema',
        'RECHAZADO',
        `Documento rechazado: ${motivo || 'Sin especificar'}`,
        docActual.status,
        'RECHAZADO',
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento rechazado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error rechazando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   GET: Descargar PDF (FORZAR DESCARGA)
   ================================ */
router.get('/:id/download', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await db.query(
      `SELECT id, title, file_path 
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const doc = result.rows[0];

    if (!doc.file_path) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    const signedUrl = await getSignedUrl(doc.file_path, 3600);

    const fileResponse = await axios.get(signedUrl, {
      responseType: 'stream',
    });

    const filename =
      (doc.title || `documento-${doc.id}`).replace(
        /[^a-zA-Z0-9-_]/g,
        '_'
      ) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    fileResponse.data.pipe(res);
  } catch (err) {
    console.error('❌ Error en descarga de documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   EXPORTAR ROUTER
   ================================ */
module.exports = router;
