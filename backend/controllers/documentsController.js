// backend/controllers/documentsController.js
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const db = require('../db');
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require('../services/emailService');
const { uploadPdfToS3, getSignedUrl } = require('../services/s3');
const { isValidEmail, isValidRun, validateLength } = require('../utils/validators');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const { sellarPdfConQr } = require('../services/pdfSeal');
const { generarNumeroContratoInterno } = require('../utils/numeroContratoInterno');
const { registrarAuditoria } = require('../utils/auditLog');

function generarCodigoVerificacion() {
  return crypto
    .randomBytes(6)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 10)
    .toUpperCase();
}

/* ================================
   FUNCION: APLICAR MARCA DE AGUA
   ================================ */
async function aplicarMarcaAguaLocal(filePath) {
  try {
    const bytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    const textoPrincipal = 'VERIFIRMA';
    const textoSecundario = 'Documento en proceso – No válido como original';
    const fontSizeMain = 30;
    const fontSizeSub = 11;
    const opacity = 0.36;
    const angle = 33;
    const xStep = 260;
    const yStep = 220;
    const color = rgb(0.6, 0.6, 0.6);

    for (const page of pages) {
      const { width, height } = page.getSize();

      for (let x = -width * 0.25; x < width * 1.25; x += xStep) {
        for (let y = -height * 0.25; y < height * 1.25; y += yStep) {
          page.drawText(textoPrincipal, {
            x,
            y,
            size: fontSizeMain,
            color,
            rotate: degrees(angle),
            opacity,
          });

          page.drawText(textoSecundario, {
            x,
            y: y - 20,
            size: fontSizeSub,
            color,
            rotate: degrees(angle),
            opacity,
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(filePath, pdfBytes);
    console.log('✅ Marca de agua VERIFIRMA aplicada a', filePath);
  } catch (err) {
    console.error('⚠️ Error aplicando marca de agua:', err);
  }
}

/* ================================
   GET: Listar documentos del usuario
   ================================ */
async function getUserDocuments(req, res) {
  try {
    const { sort } = req.query;
    let orderByClause = 'title ASC, id ASC';

    if (sort === 'fecha_desc') orderByClause = 'created_at DESC';
    if (sort === 'fecha_asc') orderByClause = 'created_at ASC';
    if (sort === 'numero_asc') orderByClause = 'numero_contrato_interno ASC';
    if (sort === 'numero_desc') orderByClause = 'numero_contrato_interno DESC';

    const result = await db.query(
      `SELECT 
         id, owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, signature_status, requires_visado, reject_reason,
         tipo_tramite, tipo_documento, requiere_firma_notarial, created_at, updated_at,
         numero_contrato_interno
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
}

/* ================================
   POST: Crear nuevo documento / trámite
   ================================ */
async function createDocument(req, res) {
  try {
    console.log('DEBUG DOCS >> POST /api/docs recibido');
    console.log('DEBUG BODY >>', {
      title: req.body.title,
      destinatario_email: req.body.destinatario_email,
      firmante_email: req.body.firmante_email,
      visador_email: req.body.visador_email,
      requiresVisado: req.body.requiresVisado,
      tipo_tramite: req.body.tipo_tramite,
      tipo_documento: req.body.tipo_documento,
      requiere_firma_notarial: req.body.requiere_firma_notarial,
      firmante_adicional_email: req.body.firmante_adicional_email,
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
      tipo_tramite,
      tipo_documento,
      requiere_firma_notarial,
    } = req.body;

    const tipoTramiteNormalizado =
      tipo_tramite === 'notaria' ? 'notaria' : 'propio';
    const tipoDocumentoNormalizado =
      tipo_documento === 'contratos' ? 'contratos' : 'poderes';

    const requiereNotaria =
      requiere_firma_notarial === 'true' || requiere_firma_notarial === true;

    if (!req.file) {
      return res.status(400).json({ message: 'El archivo PDF es obligatorio' });
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
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    if (!isValidEmail(firmante_email)) {
      return res.status(400).json({ message: 'Email del firmante inválido' });
    }

    if (!isValidEmail(destinatario_email)) {
      return res
        .status(400)
        .json({ message: 'Email del destinatario inválido' });
    }

    if (visador_email && !isValidEmail(visador_email)) {
      return res.status(400).json({ message: 'Email del visador inválido' });
    }

    if (firmante_adicional_email && !isValidEmail(firmante_adicional_email)) {
      return res
        .status(400)
        .json({ message: 'Email del firmante adicional inválido' });
    }

    console.log('DEBUG RUN ORIGINAL:', firmante_run, typeof firmante_run);
    const runValue = Array.isArray(firmante_run) ? firmante_run[0] : firmante_run;
    console.log('DEBUG RUN NORMALIZADO:', runValue, typeof runValue);

    if (!isValidRun(runValue)) {
      return res.status(400).json({
        message: 'RUN del firmante inválido (ej: 12.345.678-9)',
      });
    }

    try {
      validateLength(title, 5, 200, 'Título');
      validateLength(firmante_nombre_completo, 3, 100, 'Nombre del firmante');
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    let originalKey = null;
    let watermarkedKey = null;

    try {
      // 1) Subir ORIGINAL limpio
      originalKey = `documentos/${req.user.id}/original-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, originalKey);
      console.log(`✅ Archivo ORIGINAL subido a S3: ${originalKey}`);

      // 2) Aplicar marca de agua sobre el archivo local
      await aplicarMarcaAguaLocal(req.file.path);

      // 3) Subir VERSIÓN CON MARCA
      watermarkedKey = `documentos/${req.user.id}/watermark-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, watermarkedKey);
      console.log(`✅ Archivo CON MARCA subido a S3: ${watermarkedKey}`);
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

    const signatureToken = crypto.randomUUID();
    const signatureExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    const requires_visado = requiresVisado === 'true';

    const initialStatus = requires_visado
      ? 'PENDIENTE_VISADO'
      : 'PENDIENTE_FIRMA';

    const result = await db.query(
      `INSERT INTO documents (
         owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, requires_visado, signature_token,
         signature_token_expires_at, signature_status,
         tipo_tramite, tipo_documento, estado,
         pdf_original_url, pdf_final_url, requiere_firma_notarial,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20,
         $21, $22, $23, $24, $25, $26,
         NOW(), NOW()
       )
       RETURNING *`,
      [
        req.user.id,               // 1
        title,                     // 2
        description,               // 3
        watermarkedKey,            // 4
        initialStatus,             // 5
        destinatario_nombre,       // 6
        destinatario_email,        // 7
        destinatario_movil,        // 8
        visador_nombre,            // 9
        visador_email,             // 10
        visador_movil,             // 11
        firmante_nombre_completo,  // 12
        firmante_email,            // 13
        firmante_movil,            // 14
        runValue,                  // 15
        empresa_rut,               // 16
        requires_visado,           // 17
        signatureToken,            // 18
        signatureExpiresAt,        // 19
        'PENDIENTE',               // 20
        tipoTramiteNormalizado,    // 21
        tipoDocumentoNormalizado,  // 22
        'borrador',                // 23
        originalKey,               // 24
        null,                      // 25
        requiereNotaria,           // 26
      ]
    );

    const doc = result.rows[0];

    // ======== Número interno de contrato VF-AAAA-###### =========
    const correlativoRes = await db.query(
      `SELECT valor::bigint AS ultimo
       FROM configuraciones
       WHERE clave = 'ultimo_correlativo_contrato'`
    );

    const ultimoCorrelativo =
      correlativoRes.rowCount > 0 ? Number(correlativoRes.rows[0].ultimo) : 0;

    const numeroContratoInterno = generarNumeroContratoInterno(ultimoCorrelativo);

    await db.query(
      `INSERT INTO configuraciones (clave, valor)
       VALUES ('ultimo_correlativo_contrato', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [String(ultimoCorrelativo + 1)]
    );

    await db.query(
      `UPDATE documents
       SET numero_contrato_interno = $1
       WHERE id = $2`,
      [numeroContratoInterno, doc.id]
    );

    // ======== ENGANCHE CON TABLA documentos =========
    const codigoVerificacion = generarCodigoVerificacion();
    const categoriaFirma = 'SIMPLE';

    const documentosResult = await db.query(
      `INSERT INTO documentos (
         titulo,
         tipo,
         estado,
         categoria_firma,
         codigo_verificacion,
         creado_por,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, NOW(), NOW()
       )
       RETURNING id, codigo_verificacion, categoria_firma`,
      [
        doc.title,
        tipoTramiteNormalizado || 'propio',
        'BORRADOR',
        categoriaFirma,
        codigoVerificacion,
        req.user.id,
      ]
    );

    const documentoNuevo = documentosResult.rows[0];

    await db.query(
      `UPDATE documents
       SET nuevo_documento_id = $1
       WHERE id = $2`,
      [documentoNuevo.id, doc.id]
    );

// Firmantes en document_signers con token propio
const signerMainToken = crypto.randomUUID();
await db.query(
  `INSERT INTO document_signers (
     document_id, role, name, email, sign_token
   ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
  [doc.id, firmante_nombre_completo, firmante_email, signerMainToken]
);

// TAMBIÉN crear en tabla firmantes (para verificación pública)
try {
  await db.query(
    `INSERT INTO firmantes (
       documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
       created_at
     )
     VALUES ($1, $2, $3, $4, 'FIRMANTE', 1, 'PENDIENTE', 'SIMPLE', NOW())`,
    [documentoNuevo.id, firmante_nombre_completo, firmante_email, runValue]
  );
} catch (firmErr) {
  console.error('⚠️ Error creando firmante en tabla firmantes:', firmErr);
}

let signerAdditionalToken = null;
if (firmante_adicional_email) {
  signerAdditionalToken = crypto.randomUUID();
  await db.query(
    `INSERT INTO document_signers (
       document_id, role, name, email, sign_token
     ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
    [
      doc.id,
      firmante_adicional_nombre_completo || 'Firmante adicional',
      firmante_adicional_email,
      signerAdditionalToken,
    ]
  );

  // TAMBIÉN en tabla firmantes
  try {
    await db.query(
      `INSERT INTO firmantes (
         documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
         created_at
       )
       VALUES ($1, $2, $3, NULL, 'FIRMANTE', 2, 'PENDIENTE', 'SIMPLE', NOW())`,
      [
        documentoNuevo.id,
        firmante_adicional_nombre_completo || 'Firmante adicional',
        firmante_adicional_email,
      ]
    );
  } catch (firmErr) {
    console.error('⚠️ Error creando firmante adicional en tabla firmantes:', firmErr);
  }
}

// document_participants (solo tracking)
if (requires_visado && visador_email) {
  await db.query(
    `INSERT INTO document_participants (document_id, step_order, role, name, email)
     VALUES 
     ($1, 1, 'VISADOR', $2, $3),
     ($1, 2, 'FIRMANTE', $4, $5)`,
    [
      doc.id,
      visador_nombre || 'Visador',
      visador_email,
      firmante_nombre_completo,
      firmante_email,
    ]
  );
} else {
  await db.query(
    `INSERT INTO document_participants (document_id, step_order, role, name, email)
     VALUES 
     ($1, 2, 'FIRMANTE', $2, $3)`,
    [
      doc.id,
      firmante_nombre_completo,
      firmante_email,
    ]
  );
}

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
        initialStatus,
        'DOCUMENTO_CREADO',
        JSON.stringify({
          titulo: title,
          creadoPor: req.user.id,
          tipo_tramite: tipoTramiteNormalizado,
          tipo_documento: tipoDocumentoNormalizado,
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

    const emailPromises = [];

    const publicVerifyUrl = `${frontBaseUrl}/verificar`; // pantalla de verificación
    const verificationCode = documentoNuevo.codigo_verificacion;

    // Firmante principal
    if (firmante_email) {
      const urlFirma = `${frontBaseUrl}/firma-publica?token=${signerMainToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante:', {
        to: firmante_email,
        url: urlFirma,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_email,
          title,
          urlFirma,
          firmante_nombre_completo,
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    // Firmante adicional
    if (firmante_adicional_email && signerAdditionalToken) {
      const urlFirmaAdicional = `${frontBaseUrl}/firma-publica?token=${signerAdditionalToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante adicional:', {
        to: firmante_adicional_email,
        url: urlFirmaAdicional,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_adicional_email,
          title,
          urlFirmaAdicional,
          firmante_adicional_nombre_completo || '',
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    // Visador
    if (requires_visado && visador_email) {
      const urlVisado = `${frontBaseUrl}/firma-publica?token=${signatureToken}&mode=visado`;
      console.log('📧 [DOC EMAIL] Invitación visador:', {
        to: visador_email,
        url: urlVisado,
      });

      emailPromises.push(
        sendVisadoInvitation(
          visador_email,
          title,
          urlVisado,
          visador_nombre || ''
        )
      );
    }

    // Destinatario / empresa (consulta pública)
if (destinatario_email && destinatario_email !== firmante_email) {
  console.log('📧 [DOC EMAIL] Notificación informativa destinatario:', {
    to: destinatario_email,
  });

  const { sendDestinationNotification } = require('../services/emailService');

  emailPromises.push(
    sendDestinationNotification(
      destinatario_email,
      title,
      destinatario_nombre || empresa_rut || 'Empresa',
      verificationCode
    )
  );
}
    try {
      await Promise.all(emailPromises);
    } catch (emailError) {
      console.error(
        '⚠️ [DOC EMAIL] Algún correo falló al enviar:',
        emailError.message
      );
    }

    return res.status(201).json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path,
      documentoId: documentoNuevo.id,
      codigoVerificacion: documentoNuevo.codigo_verificacion,
      categoriaFirma: documentoNuevo.categoria_firma,
      message:
        'Documento creado exitosamente. Correos enviados (o intentados enviar) antes de responder.',
    });
  } catch (err) {
    console.error('❌ Error creando documento:', err);
    return res
      .status(500)
      .json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: URL firmada solo para VER PDF
   ================================ */
async function getDocumentPdf(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT file_path, pdf_original_url, pdf_final_url, estado, status
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const {
      file_path,
      pdf_original_url,
      pdf_final_url,
      estado,
      status,
    } = result.rows[0];

    if (!file_path && !pdf_original_url) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    if (status === 'FIRMADO' && pdf_final_url) {
      const signedUrlFinal = await getSignedUrl(pdf_final_url, 3600);
      return res.json({ url: signedUrlFinal, final: true });
    }

    const key = pdf_original_url || file_path;
    const signedUrl = await getSignedUrl(key, 3600);

    return res.json({
      url: signedUrl,
      final: false,
    });
  } catch (err) {
    console.error('❌ Error obteniendo PDF:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: Timeline del documento
   ================================ */
async function getTimeline(req, res) {
  try {
    const docId = req.params.id;

    const docRes = await db.query(
      `SELECT 
         id, title, status, destinatario_nombre,
         empresa_rut, created_at, updated_at,
         requires_visado, firmante_nombre, visador_nombre,
         numero_contrato_interno,
         tipo_tramite, tipo_documento
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

    if (doc.status === 'PENDIENTE_VISADO') {
      currentStep = 'Pendiente de visado';
      nextStep = '⏳ Esperando visación';
      progress = 25;
    } else if (doc.status === 'PENDIENTE_FIRMA') {
      currentStep = 'Pendiente de firma';
      nextStep = '⏳ Esperando firma';
      progress = doc.requires_visado ? 75 : 50;
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
        numero_contrato_interno: doc.numero_contrato_interno,
	tipo_tramite: doc.tipo_tramite,
  	tipo_documento: doc.tipo_documento,
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
}

/* ================================
   GET: Firmantes de un documento
   ================================ */
async function getSigners(req, res) {
  try {
    const { id } = req.params;

    const docRes = await db.query(
      `SELECT id FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const signersRes = await db.query(
      `SELECT id, name, email, status
       FROM document_signers
       WHERE document_id = $1
       ORDER BY id ASC`,
      [id]
    );

    return res.json(signersRes.rows);
  } catch (err) {
    console.error('❌ Error obteniendo firmantes:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
async function signDocument(req, res) {
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

    if (
      docActual.requires_visado === true &&
      docActual.status === 'PENDIENTE_VISADO'
    ) {
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
        'Firmado por propietario',
        docActual.status,
        'FIRMADO',
      ]
    );

    // ✅ Registrar en auditoría
    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'FIRMADO',
      descripcion: 'Documento firmado por propietario',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    if (doc.nuevo_documento_id) {
      try {
        const docNuevoRes = await db.query(
          `SELECT id, codigo_verificacion, categoria_firma
           FROM documentos
           WHERE id = $1`,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];

          const newKey = await sellarPdfConQr({
            s3Key: doc.pdf_original_url || doc.file_path,
            documentoId: docNuevo.id,
            codigoVerificacion: docNuevo.codigo_verificacion,
            categoriaFirma: docNuevo.categoria_firma || 'SIMPLE',
            numeroContratoInterno: doc.numero_contrato_interno,
          });

          await db.query(
            `UPDATE documents
             SET pdf_final_url = $1
             WHERE id = $2`,
            [newKey, doc.id]
          );
        }
      } catch (sealError) {
        console.error('⚠️ Error sellando PDF con QR:', sealError);
      }
    }

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento firmado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error firmando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   POST: Visar documento (propietario)
   ================================ */
async function visarDocument(req, res) {
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

    if (docActual.status !== 'PENDIENTE_VISADO') {
      return res.status(400).json({
        message: 'Solo se pueden visar documentos en estado PENDIENTE_VISADO',
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING *`,
      ['PENDIENTE_FIRMA', id, req.user.id]
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
        'PENDIENTE_FIRMA',
      ]
    );

    // ✅ Registrar en auditoría
    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'VISADO',
      descripcion: 'Documento visado por propietario',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento visado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error visando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
 * POST: Rechazar documento (propietario)
 * ================================ */
async function rejectDocument(req, res) {
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

    // Registrar evento en document_events (para UI)
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

    // ✅ Registrar en auditoría
    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'RECHAZADO',
      descripcion: `Documento rechazado. Motivo: ${motivo || 'Sin especificar'}`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento rechazado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error rechazando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   FUNCION: APLICAR MARCA DE AGUA
   ================================ */
async function aplicarMarcaAguaLocal(filePath) {
  try {
    const bytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    const textoPrincipal = 'VERIFIRMA';
    const textoSecundario = 'Documento en proceso – No válido como original';
    const fontSizeMain = 30;
    const fontSizeSub = 11;
    const opacity = 0.36;
    const angle = 33;
    const xStep = 260;
    const yStep = 220;
    const color = rgb(0.6, 0.6, 0.6);

    for (const page of pages) {
      const { width, height } = page.getSize();

      for (let x = -width * 0.25; x < width * 1.25; x += xStep) {
        for (let y = -height * 0.25; y < height * 1.25; y += yStep) {
          page.drawText(textoPrincipal, {
            x,
            y,
            size: fontSizeMain,
            color,
            rotate: degrees(angle),
            opacity,
          });

          page.drawText(textoSecundario, {
            x,
            y: y - 20,
            size: fontSizeSub,
            color,
            rotate: degrees(angle),
            opacity,
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(filePath, pdfBytes);
    console.log('✅ Marca de agua VERIFIRMA aplicada a', filePath);
  } catch (err) {
    console.error('⚠️ Error aplicando marca de agua:', err);
  }
}

/* ================================
   GET: Listar documentos del usuario
   ================================ */
async function getUserDocuments(req, res) {
  try {
    const { sort } = req.query;
    let orderByClause = 'title ASC, id ASC';

    if (sort === 'fecha_desc') orderByClause = 'created_at DESC';
    if (sort === 'fecha_asc') orderByClause = 'created_at ASC';
    if (sort === 'numero_asc') orderByClause = 'numero_contrato_interno ASC';
    if (sort === 'numero_desc') orderByClause = 'numero_contrato_interno DESC';

    const result = await db.query(
      `SELECT 
         id, owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, signature_status, requires_visado, reject_reason,
         tipo_tramite, tipo_documento, requiere_firma_notarial, created_at, updated_at,
         numero_contrato_interno
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
}

/* ================================
   POST: Crear nuevo documento / trámite
   ================================ */
async function createDocument(req, res) {
  try {
    console.log('DEBUG DOCS >> POST /api/docs recibido');
    console.log('DEBUG BODY >>', {
      title: req.body.title,
      destinatario_email: req.body.destinatario_email,
      firmante_email: req.body.firmante_email,
      visador_email: req.body.visador_email,
      requiresVisado: req.body.requiresVisado,
      tipo_tramite: req.body.tipo_tramite,
      tipo_documento: req.body.tipo_documento,
      requiere_firma_notarial: req.body.requiere_firma_notarial,
      firmante_adicional_email: req.body.firmante_adicional_email,
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
      tipo_tramite,
      tipo_documento,
      requiere_firma_notarial,
    } = req.body;

    const tipoTramiteNormalizado =
      tipo_tramite === 'notaria' ? 'notaria' : 'propio';
    const tipoDocumentoNormalizado =
      tipo_documento === 'contratos' ? 'contratos' : 'poderes';

    const requiereNotaria =
      requiere_firma_notarial === 'true' || requiere_firma_notarial === true;

    if (!req.file) {
      return res.status(400).json({ message: 'El archivo PDF es obligatorio' });
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
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    if (!isValidEmail(firmante_email)) {
      return res.status(400).json({ message: 'Email del firmante inválido' });
    }

    if (!isValidEmail(destinatario_email)) {
      return res
        .status(400)
        .json({ message: 'Email del destinatario inválido' });
    }

    if (visador_email && !isValidEmail(visador_email)) {
      return res.status(400).json({ message: 'Email del visador inválido' });
    }

    if (firmante_adicional_email && !isValidEmail(firmante_adicional_email)) {
      return res
        .status(400)
        .json({ message: 'Email del firmante adicional inválido' });
    }

    console.log('DEBUG RUN ORIGINAL:', firmante_run, typeof firmante_run);
    const runValue = Array.isArray(firmante_run) ? firmante_run[0] : firmante_run;
    console.log('DEBUG RUN NORMALIZADO:', runValue, typeof runValue);

    if (!isValidRun(runValue)) {
      return res.status(400).json({
        message: 'RUN del firmante inválido (ej: 12.345.678-9)',
      });
    }

    try {
      validateLength(title, 5, 200, 'Título');
      validateLength(firmante_nombre_completo, 3, 100, 'Nombre del firmante');
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    let originalKey = null;
    let watermarkedKey = null;

    try {
      originalKey = `documentos/${req.user.id}/original-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, originalKey);
      console.log(`✅ Archivo ORIGINAL subido a S3: ${originalKey}`);

      await aplicarMarcaAguaLocal(req.file.path);

      watermarkedKey = `documentos/${req.user.id}/watermark-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, watermarkedKey);
      console.log(`✅ Archivo CON MARCA subido a S3: ${watermarkedKey}`);
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

    const signatureToken = crypto.randomUUID();
    const signatureExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    const requires_visado = requiresVisado === 'true';

    const initialStatus = requires_visado
      ? 'PENDIENTE_VISADO'
      : 'PENDIENTE_FIRMA';

    const result = await db.query(
      `INSERT INTO documents (
         owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, requires_visado, signature_token,
         signature_token_expires_at, signature_status,
         tipo_tramite, tipo_documento, estado,
         pdf_original_url, pdf_final_url, requiere_firma_notarial,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20,
         $21, $22, $23, $24, $25, $26,
         NOW(), NOW()
       )
       RETURNING *`,
      [
        req.user.id,
        title,
        description,
        watermarkedKey,
        initialStatus,
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
        tipoTramiteNormalizado,
        tipoDocumentoNormalizado,
        'borrador',
        originalKey,
        null,
        requiereNotaria,
      ]
    );

    const doc = result.rows[0];

    const correlativoRes = await db.query(
      `SELECT valor::bigint AS ultimo
       FROM configuraciones
       WHERE clave = 'ultimo_correlativo_contrato'`
    );

    const ultimoCorrelativo =
      correlativoRes.rowCount > 0 ? Number(correlativoRes.rows[0].ultimo) : 0;

    const numeroContratoInterno = generarNumeroContratoInterno(ultimoCorrelativo);

    await db.query(
      `INSERT INTO configuraciones (clave, valor)
       VALUES ('ultimo_correlativo_contrato', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [String(ultimoCorrelativo + 1)]
    );

    await db.query(
      `UPDATE documents
       SET numero_contrato_interno = $1
       WHERE id = $2`,
      [numeroContratoInterno, doc.id]
    );

    const codigoVerificacion = generarCodigoVerificacion();
    const categoriaFirma = 'SIMPLE';

    const documentosResult = await db.query(
      `INSERT INTO documentos (
         titulo,
         tipo,
         estado,
         categoria_firma,
         codigo_verificacion,
         creado_por,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, NOW(), NOW()
       )
       RETURNING id, codigo_verificacion, categoria_firma`,
      [
        doc.title,
        tipoTramiteNormalizado || 'propio',
        'BORRADOR',
        categoriaFirma,
        codigoVerificacion,
        req.user.id,
      ]
    );

    const documentoNuevo = documentosResult.rows[0];

    await db.query(
      `UPDATE documents
       SET nuevo_documento_id = $1
       WHERE id = $2`,
      [documentoNuevo.id, doc.id]
    );

    // Firmantes en document_signers
    const signerMainToken = crypto.randomUUID();
    await db.query(
      `INSERT INTO document_signers (
         document_id, role, name, email, sign_token
       ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
      [doc.id, firmante_nombre_completo, firmante_email, signerMainToken]
    );

    // Tabla firmantes (verificación pública)
    try {
      await db.query(
        `INSERT INTO firmantes (
           documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
           created_at
         )
         VALUES ($1, $2, $3, $4, 'FIRMANTE', 1, 'PENDIENTE', 'SIMPLE', NOW())`,
        [documentoNuevo.id, firmante_nombre_completo, firmante_email, runValue]
      );
    } catch (firmErr) {
      console.error('⚠️ Error creando firmante en tabla firmantes:', firmErr);
    }

    let signerAdditionalToken = null;
    if (firmante_adicional_email) {
      signerAdditionalToken = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_signers (
           document_id, role, name, email, sign_token
         ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
        [
          doc.id,
          firmante_adicional_nombre_completo || 'Firmante adicional',
          firmante_adicional_email,
          signerAdditionalToken,
        ]
      );

      try {
        await db.query(
          `INSERT INTO firmantes (
             documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
             created_at
           )
           VALUES ($1, $2, $3, NULL, 'FIRMANTE', 2, 'PENDIENTE', 'SIMPLE', NOW())`,
          [
            documentoNuevo.id,
            firmante_adicional_nombre_completo || 'Firmante adicional',
            firmante_adicional_email,
          ]
        );
      } catch (firmErr) {
        console.error('⚠️ Error creando firmante adicional en tabla firmantes:', firmErr);
      }
    }

    // document_participants (tracking)
    if (requires_visado && visador_email) {
      await db.query(
        `INSERT INTO document_participants (document_id, step_order, role, name, email)
         VALUES 
         ($1, 1, 'VISADOR', $2, $3),
         ($1, 2, 'FIRMANTE', $4, $5)`,
        [
          doc.id,
          visador_nombre || 'Visador',
          visador_email,
          firmante_nombre_completo,
          firmante_email,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO document_participants (document_id, step_order, role, name, email)
         VALUES 
         ($1, 2, 'FIRMANTE', $2, $3)`,
        [
          doc.id,
          firmante_nombre_completo,
          firmante_email,
        ]
      );
    }

    // Evento de creación para el timeline
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
        initialStatus,
        'DOCUMENTO_CREADO',
        JSON.stringify({
          titulo: title,
          creadoPor: req.user.id,
          tipo_tramite: tipoTramiteNormalizado,
          tipo_documento: tipoDocumentoNormalizado,
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

    const emailPromises = [];

    const publicVerifyUrl = `${frontBaseUrl}/verificar`;
    const verificationCode = documentoNuevo.codigo_verificacion;

    // Firmante principal
    if (firmante_email) {
      const urlFirma = `${frontBaseUrl}/firma-publica?token=${signerMainToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante:', {
        to: firmante_email,
        url: urlFirma,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_email,
          title,
          urlFirma,
          firmante_nombre_completo,
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    // Firmante adicional
    if (firmante_adicional_email && signerAdditionalToken) {
      const urlFirmaAdicional = `${frontBaseUrl}/firma-publica?token=${signerAdditionalToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante adicional:', {
        to: firmante_adicional_email,
        url: urlFirmaAdicional,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_adicional_email,
          title,
          urlFirmaAdicional,
          firmante_adicional_nombre_completo || '',
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    // Visador
    if (requires_visado && visador_email) {
      const urlVisado = `${frontBaseUrl}/firma-publica?token=${signatureToken}&mode=visado`;
      console.log('📧 [DOC EMAIL] Invitación visador:', {
        to: visador_email,
        url: urlVisado,
      });

      emailPromises.push(
        sendVisadoInvitation(
          visador_email,
          title,
          urlVisado,
          visador_nombre || ''
        )
      );
    }

    // Destinatario / empresa
    if (destinatario_email && destinatario_email !== firmante_email) {
      console.log('📧 [DOC EMAIL] Notificación informativa destinatario:', {
        to: destinatario_email,
      });

      const { sendDestinationNotification } = require('../services/emailService');

      emailPromises.push(
        sendDestinationNotification(
          destinatario_email,
          title,
          destinatario_nombre || empresa_rut || 'Empresa',
          verificationCode
        )
      );
    }

    try {
      await Promise.all(emailPromises);
    } catch (emailError) {
      console.error(
        '⚠️ [DOC EMAIL] Algún correo falló al enviar:',
        emailError.message
      );
    }

    return res.status(201).json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path,
      documentoId: documentoNuevo.id,
      codigoVerificacion: documentoNuevo.codigo_verificacion,
      categoriaFirma: documentoNuevo.categoria_firma,
      message:
        'Documento creado exitosamente. Correos enviados (o intentados enviar) antes de responder.',
    });
  } catch (err) {
    console.error('❌ Error creando documento:', err);
    return res
      .status(500)
      .json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: URL firmada solo para VER PDF
   ================================ */
async function getDocumentPdf(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT file_path, pdf_original_url, pdf_final_url, estado, status
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const {
      file_path,
      pdf_original_url,
      pdf_final_url,
      estado,
      status,
    } = result.rows[0];

    if (!file_path && !pdf_original_url) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    if (status === 'FIRMADO' && pdf_final_url) {
      const signedUrlFinal = await getSignedUrl(pdf_final_url, 3600);
      return res.json({ url: signedUrlFinal, final: true });
    }

    const key = pdf_original_url || file_path;
    const signedUrl = await getSignedUrl(key, 3600);

    return res.json({
      url: signedUrl,
      final: false,
    });
  } catch (err) {
    console.error('❌ Error obteniendo PDF:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: Timeline del documento
   ================================ */
async function getTimeline(req, res) {
  try {
    const docId = req.params.id;

    const docRes = await db.query(
      `SELECT 
         id, title, status, destinatario_nombre,
         empresa_rut, created_at, updated_at,
         requires_visado, firmante_nombre, visador_nombre,
         numero_contrato_interno,
         tipo_tramite, tipo_documento
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

    if (doc.status === 'PENDIENTE_VISADO') {
      currentStep = 'Pendiente de visado';
      nextStep = '⏳ Esperando visación';
      progress = 25;
    } else if (doc.status === 'PENDIENTE_FIRMA') {
      currentStep = 'Pendiente de firma';
      nextStep = '⏳ Esperando firma';
      progress = doc.requires_visado ? 75 : 50;
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
        numero_contrato_interno: doc.numero_contrato_interno,
        tipo_tramite: doc.tipo_tramite,
        tipo_documento: doc.tipo_documento,
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
}

/* ================================
   GET: Firmantes de un documento
   ================================ */
async function getSigners(req, res) {
  try {
    const { id } = req.params;

    const docRes = await db.query(
      `SELECT id FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const signersRes = await db.query(
      `SELECT id, name, email, status
       FROM document_signers
       WHERE document_id = $1
       ORDER BY id ASC`,
      [id]
    );

    return res.json(signersRes.rows);
  } catch (err) {
    console.error('❌ Error obteniendo firmantes:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
async function signDocument(req, res) {
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

    if (
      docActual.requires_visado === true &&
      docActual.status === 'PENDIENTE_VISADO'
    ) {
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
        'Firmado por propietario',
        docActual.status,
        'FIRMADO',
      ]
    );

    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'FIRMADO',
      descripcion: 'Documento firmado por propietario',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    if (doc.nuevo_documento_id) {
      try {
        const docNuevoRes = await db.query(
          `SELECT id, codigo_verificacion, categoria_firma
           FROM documentos
           WHERE id = $1`,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];

          const newKey = await sellarPdfConQr({
            s3Key: doc.pdf_original_url || doc.file_path,
            documentoId: docNuevo.id,
            codigoVerificacion: docNuevo.codigo_verificacion,
            categoriaFirma: docNuevo.categoria_firma || 'SIMPLE',
            numeroContratoInterno: doc.numero_contrato_interno,
          });

          await db.query(
            `UPDATE documents
             SET pdf_final_url = $1
             WHERE id = $2`,
            [newKey, doc.id]
          );
        }
      } catch (sealError) {
        console.error('⚠️ Error sellando PDF con QR:', sealError);
      }
    }

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento firmado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error firmando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   POST: Visar documento (propietario)
   ================================ */
async function visarDocument(req, res) {
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

    if (docActual.status !== 'PENDIENTE_VISADO') {
      return res.status(400).json({
        message: 'Solo se pueden visar documentos en estado PENDIENTE_VISADO',
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING *`,
      ['PENDIENTE_FIRMA', id, req.user.id]
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
        'PENDIENTE_FIRMA',
      ]
    );

    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'VISADO',
      descripcion: 'Documento visado por propietario',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento visado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error visando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
 * POST: Rechazar documento (propietario)
 * ================================ */
async function rejectDocument(req, res) {
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

    await registrarAuditoria({
      documento_id: doc.id,
      usuario_id: req.user.id,
      evento_tipo: 'RECHAZADO',
      descripcion: `Documento rechazado. Motivo: ${motivo || 'Sin especificar'}`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento rechazado exitosamente',
    });
  } catch (err) {
    console.error('❌ Error rechazando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// (resto de funciones: resendReminder, downloadDocument, getDocumentAnalytics,
// sendAutomaticReminders, downloadReportPdf) se mantiene igual que ya tenías.

module.exports = {
  getUserDocuments,
  createDocument,
  getDocumentPdf,
  getTimeline,
  getSigners,
  signDocument,
  visarDocument,
  rejectDocument,
  resendReminder,
  downloadDocument,
  getDocumentAnalytics,
  sendAutomaticReminders,
  downloadReportPdf,
};
