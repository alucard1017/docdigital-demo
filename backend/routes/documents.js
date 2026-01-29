const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendSignatureInviteEmail } = require('../services/sendSignatureInviteEmail');
const { uploadPdfToS3, downloadPdfFromS3, deletePdfFromS3, getSignedUrl } = require('../services/s3');

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
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
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
  }
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'El archivo supera el tamaño máximo permitido (25 MB).' });
  }
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ message: 'Solo se permiten archivos PDF' });
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
      `SELECT id, owner_id, title, description, file_path, status, destinatario_nombre, destinatario_email, destinatario_movil, visador_nombre, visador_email, visador_movil, firmante_nombre, firmante_email, firmante_movil, firmante_run, empresa_rut, signature_status, requires_visado, reject_reason, created_at, updated_at 
       FROM documents 
       WHERE owner_id = $1 
       ORDER BY ${orderByClause}`,
      [req.user.id]
    );

    const docs = result.rows.map((row) => ({
      ...row,
      requiresVisado: row.requires_visado === true,
      file_url: row.file_path // S3 URL o ruta local
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
router.post('/', requireAuth, upload.single('file'), handleMulterError, async (req, res) => {
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
      requiresVisado
    } = req.body;

    // Validaciones
    if (!req.file) return res.status(400).json({ message: 'El archivo PDF es obligatorio' });
    if (!title || !firmante_nombre_completo || !firmante_email || !firmante_run || !destinatario_nombre || !destinatario_email || !empresa_rut) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Subir archivo a S3
    let s3FilePath = null;
    try {
      const fileName = `documentos/${req.user.id}/${Date.now()}-${req.file.originalname}`;
      const s3Url = await uploadPdfToS3(req.file.path, fileName);
      s3FilePath = fileName; // Guardar referencia en BD
      
      console.log(`✅ Archivo subido a S3: ${fileName}`);
    } catch (s3Error) {
      console.error('⚠️ Error subiendo a S3, usando archivo local:', s3Error.message);
      s3FilePath = '/uploads/temporal/' + req.file.filename;
    }

    // Generar token de firma
    const signatureToken = crypto.randomUUID();
    const signatureExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
    const requires_visado = requiresVisado === 'true';

    // Insertar documento en BD
    const result = await db.query(
      `INSERT INTO documents (
        owner_id, title, description, file_path, status, 
        destinatario_nombre, destinatario_email, destinatario_movil, 
        visador_nombre, visador_email, visador_movil, 
        firmante_nombre, firmante_email, firmante_movil, firmante_run, 
        empresa_rut, requires_visado, signature_token, signature_token_expires_at, 
        signature_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()) 
       RETURNING *`,
      [
        req.user.id, title, description, s3FilePath, 'PENDIENTE',
        destinatario_nombre, destinatario_email, destinatario_movil,
        visador_nombre, visador_email, visador_movil,
        firmante_nombre_completo, firmante_email, firmante_movil, firmante_run,
        empresa_rut, requires_visado, signatureToken, signatureExpiresAt, 'PENDIENTE'
      ]
    );

    const doc = result.rows[0];

    // Registrar evento
    await db.query(
      `INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [doc.id, req.user.name || 'Sistema', 'CREADO', `Documento "${title}" creado`, null, 'PENDIENTE']
    );

    // Enviar email con enlace de firma
    const frontBaseUrl = process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';
    await sendSignatureInviteEmail({
      signer_email: firmante_email,
      signer_name: firmante_nombre_completo,
      document_title: title,
      sign_url: `${frontBaseUrl}/?token=${signatureToken}`
    });

    // Limpiar archivo temporal
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('⚠️ Error eliminando archivo temporal:', err);
      });
    }

    return res.status(201).json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path,
      message: 'Documento creado y subido a S3'
    });
  } catch (err) {
    console.error('❌ Error creando documento:', err);
    
    // Limpiar archivo temporal en caso de error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('⚠️ Error limpiando temporal:', err);
      });
    }
    
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
      `SELECT id, title, status, destinatario_nombre, empresa_rut, created_at, updated_at, requires_visado, firmante_nombre, visador_nombre 
       FROM documents 
       WHERE id = $1`,
      [docId]
    );

    if (docRes.rows.length === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const doc = docRes.rows[0];
    const eventsRes = await db.query(
      `SELECT id, action, details, actor, from_status, to_status, created_at 
       FROM document_events 
       WHERE document_id = $1 
       ORDER BY created_at ASC`,
      [docId]
    );

    const events = eventsRes.rows;
    let currentStep = 'Pendiente', nextStep = '', progress = 0;

    if (doc.status === 'PENDIENTE') {
      if (doc.requires_visado) {
        nextStep = `⏳ Esperando visación`;
        progress = 25;
      } else {
        nextStep = `⏳ Esperando firma`;
        progress = 50;
      }
    } else if (doc.status === 'VISADO') {
      currentStep = 'Visado';
      nextStep = `⏳ Esperando firma`;
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
      toStatus: evt.to_status
    }));

    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        requires_visado: doc.requires_visado
      },
      timeline: {
        currentStep,
        nextStep,
        progress,
        events: formattedEvents
      }
    });
  } catch (err) {
    console.error('❌ Error obteniendo timeline:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
router.post('/:id/firmar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const current = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
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

    const result = await db.query(
      `UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING *`,
      ['FIRMADO', id, req.user.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [doc.id, req.user.name || 'Sistema', 'FIRMADO', 'Firmado', docActual.status, 'FIRMADO']
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento firmado exitosamente'
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
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const docActual = current.rows[0];
    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({ message: 'Ya firmado' });
    }
    if (docActual.status !== 'PENDIENTE') {
      return res.status(400).json({ message: 'Solo se pueden visar documentos PENDIENTES' });
    }

    const result = await db.query(
      `UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING *`,
      ['VISADO', id, req.user.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events
