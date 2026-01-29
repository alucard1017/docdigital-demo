const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendSignatureInviteEmail } = require('../services/sendSignatureInviteEmail');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'El archivo supera el tamaño máximo permitido (25 MB).' });
  }
  return next(err);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { sort } = req.query;
    let orderByClause = 'title ASC, id ASC';
    if (sort === 'fecha_desc') orderByClause = 'created_at DESC';
    if (sort === 'fecha_asc') orderByClause = 'created_at ASC';

    const result = await db.query(`SELECT id, owner_id, title, description, file_path, status, destinatario_nombre, destinatario_email, destinatario_movil, visador_nombre, visador_email, visador_movil, firmante_nombre, firmante_email, firmante_movil, firmante_run, empresa_rut, signature_status, requires_visado, reject_reason, created_at, updated_at FROM documents WHERE owner_id = $1 ORDER BY ${orderByClause}`, [req.user.id]);

    const docs = result.rows.map((row) => ({ ...row, requiresVisado: row.requires_visado === true, file_url: row.file_path }));
    return res.json(docs);
  } catch (err) {
    console.error('Error listando documentos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.post('/', requireAuth, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    const { title, description, destinatario_nombre, destinatario_email, destinatario_movil, visador_nombre, visador_email, visador_movil, firmante_nombre_completo, firmante_email, firmante_movil, firmante_run, empresa_rut, requiresVisado } = req.body;

    if (!req.file) return res.status(400).json({ message: 'El archivo PDF es obligatorio' });
    if (!title || !firmante_nombre_completo || !firmante_email || !firmante_run || !destinatario_nombre || !destinatario_email || !empresa_rut) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const filePath = '/uploads/' + req.file.filename;
    const requires_visado = requiresVisado === 'true';
    const signatureToken = crypto.randomUUID();
    const signatureExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await db.query(`INSERT INTO documents (owner_id, title, description, file_path, status, destinatario_nombre, destinatario_email, destinatario_movil, visador_nombre, visador_email, visador_movil, firmante_nombre, firmante_email, firmante_movil, firmante_run, empresa_rut, requires_visado, signature_token, signature_token_expires_at, signature_status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()) RETURNING *`, [req.user.id, title, description, filePath, 'PENDIENTE', destinatario_nombre, destinatario_email, destinatario_movil, visador_nombre, visador_email, visador_movil, firmante_nombre_completo, firmante_email, firmante_movil, firmante_run, empresa_rut, requires_visado, signatureToken, signatureExpiresAt, 'PENDIENTE']);

    const doc = result.rows[0];

    await db.query(`INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) VALUES ($1, $2, $3, $4, $5, $6)`, [doc.id, req.user.name || 'Sistema', 'CREADO', `Documento "${title}" creado`, null, 'PENDIENTE']);

    const frontBaseUrl = process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';
    await sendSignatureInviteEmail({ signer_email: firmante_email, signer_name: firmante_nombre_completo, document_title: title, sign_url: `${frontBaseUrl}/?token=${signatureToken}` });

    return res.status(201).json({ ...doc, requiresVisado: doc.requires_visado === true, file_url: doc.file_path });
  } catch (err) {
    console.error('Error creando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const docId = req.params.id;
    const docRes = await db.query(`SELECT id, title, status, destinatario_nombre, empresa_rut, created_at, updated_at, requires_visado, firmante_nombre, visador_nombre FROM documents WHERE id = $1`, [docId]);

    if (docRes.rows.length === 0) return res.status(404).json({ message: 'Documento no encontrado' });

    const doc = docRes.rows[0];
    const eventsRes = await db.query(`SELECT id, action, details, actor, from_status, to_status, created_at FROM document_events WHERE document_id = $1 ORDER BY created_at ASC`, [docId]);

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

    const formattedEvents = events.map((evt) => ({ id: evt.id, action: evt.action, details: evt.details, actor: evt.actor, timestamp: evt.created_at, fromStatus: evt.from_status, toStatus: evt.to_status }));

    res.json({ document: { id: doc.id, title: doc.title, status: doc.status, destinatario_nombre: doc.destinatario_nombre, empresa_rut: doc.empresa_rut, created_at: doc.created_at, updated_at: doc.updated_at, requires_visado: doc.requires_visado }, timeline: { currentStep, nextStep, progress, events: formattedEvents } });
  } catch (err) {
    console.error('Error timeline:', err);
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/:id/firmar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const current = await db.query(`SELECT * FROM documents WHERE id = $1 AND owner_id = $2`, [id, req.user.id]);

    if (current.rowCount === 0) return res.status(404).json({ message: 'No encontrado' });

    const docActual = current.rows[0];
    if (docActual.status === 'FIRMADO') return res.status(400).json({ message: 'Ya firmado' });
    if (docActual.status === 'RECHAZADO') return res.status(400).json({ message: 'Rechazado' });

    const result = await db.query(`UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING *`, ['FIRMADO', id, req.user.id]);
    const doc = result.rows[0];

    await db.query(`INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) VALUES ($1, $2, $3, $4, $5, $6)`, [doc.id, req.user.name || 'Sistema', 'FIRMADO', 'Firmado', docActual.status, 'FIRMADO']);

    return res.json({ ...doc, file_url: doc.file_path });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ message: 'Error' });
  }
});

router.post('/:id/visar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const current = await db.query(`SELECT * FROM documents WHERE id = $1 AND owner_id = $2`, [id, req.user.id]);

    if (current.rowCount === 0) return res.status(404).json({ message: 'No encontrado' });

    const docActual = current.rows[0];
    if (docActual.status === 'FIRMADO') return res.status(400).json({ message: 'Ya firmado' });
    if (docActual.status !== 'PENDIENTE') return res.status(400).json({ message: 'Solo PENDIENTES' });

    const result = await db.query(`UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING *`, ['VISADO', id, req.user.id]);
    const doc = result.rows[0];

    await db.query(`INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) VALUES ($1, $2, $3, $4, $5, $6)`, [doc.id, req.user.name || 'Sistema', 'VISADO', 'Visado', docActual.status, 'VISADO']);

    return res.json({ ...doc, file_url: doc.file_path });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ message: 'Error' });
  }
});

router.post('/:id/rechazar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { motivo } = req.body;

    if (!motivo) return res.status(400).json({ message: 'Motivo requerido' });

    const current = await db.query(`SELECT * FROM documents WHERE id = $1 AND owner_id = $2`, [id, req.user.id]);

    if (current.rowCount === 0) return res.status(404).json({ message: 'No encontrado' });

    const docActual = current.rows[0];
    if (docActual.status === 'FIRMADO') return res.status(400).json({ message: 'Ya firmado' });

    const result = await db.query(`UPDATE documents SET status = $1, reject_reason = $2, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING *`, ['RECHAZADO', motivo, id, req.user.id]);
    const doc = result.rows[0];

    await db.query(`INSERT INTO document_events (document_id, actor, action, details, from_status, to_status) VALUES ($1, $2, $3, $4, $5, $6)`, [doc.id, req.user.name || 'Sistema', 'RECHAZADO', motivo, docActual.status, 'RECHAZADO']);

    return res.json({ ...doc, file_url: doc.file_path });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ message: 'Error' });
  }
});

router.get('/:id/events', requireAuth, async (req, res) => {
  try {
    const eventsResult = await db.query(`SELECT id, action, details, created_at FROM document_events WHERE document_id = $1 ORDER BY created_at ASC`, [req.params.id]);
    return res.json(eventsResult.rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error' });
  }
});

router.post('/:id/reminder', requireAuth, async (req, res) => {
  try {
    const current = await db.query(`SELECT id FROM documents WHERE id = $1 AND owner_id = $2`, [req.params.id, req.user.id]);
    if (current.rowCount === 0) return res.status(404).json({ message: 'No encontrado' });
    return res.json({ message: 'Recordatorio enviado' });
  } catch (err) {
    return res.status(500).json({ message: 'Error' });
  }
});

router.get('/public/sign/:token', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, title, file_path, firmante_nombre, firmante_email, firmante_run, empresa_rut, destinatario_nombre, destinatario_email, signature_status, signature_token_expires_at FROM documents WHERE signature_token = $1`, [req.params.token]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'No válido' });

    const doc = result.rows[0];
    if (doc.signature_token_expires_at && new Date(doc.signature_token_expires_at) < new Date()) {
      return res.status(410).json({ message: 'El enlace de firma ha expirado' });
    }

    return res.json({
      id: doc.id, title: doc.title, file_url: doc.file_path, firmante_nombre: doc.firmante_nombre,
      firmante_email: doc.firmante_email, firmante_run: doc.firmante_run, empresa_rut: doc.empresa_rut,
      destinatario_nombre: doc.destinatario_nombre, destinatario_email: doc.destinatario_email,
      signature_status: doc.signature_status
    });
  } catch (err) {
    console.error('Error obteniendo info pública de firma:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.post('/public/sign/:token/confirm', async (req, res) => {
  try {
    const { token } = req.params;
    const current = await db.query(`
      SELECT id, status, signature_status, signature_token_expires_at FROM documents WHERE signature_token = $1
    `, [token]);

    if (current.rowCount === 0) return res.status(404).json({ message: 'Enlace de firma no válido' });

    const docActual = current.rows[0];
    if (docActual.signature_token_expires_at && new Date(docActual.signature_token_expires_at) < new Date()) {
      return res.status(410).json({ message: 'El enlace de firma ha expirado' });
    }

    if (docActual.signature_status === 'FIRMADO') {
      return res.status(400).json({ message: 'El documento ya fue firmado por el representante' });
    }

    const result = await db.query(`
      UPDATE documents SET signature_status = 'FIRMADO', status = 'FIRMADO', updated_at = NOW()
      WHERE signature_token = $1 RETURNING *
    `, [token]);

    const doc = result.rows[0];

    await db.query(`
      INSERT INTO document_events (document_id, actor, action, details, from_status, to_status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [doc.id, 'Representante Legal', 'FIRMADO_REPRESENTANTE', 'Documento firmado mediante enlace externo', docActual.status, 'FIRMADO']);

    return res.json({ message: 'Firma registrada correctamente' });
  } catch (err) {
    console.error('Error confirmando firma pública:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    const docsResult = await db.query(`SELECT file_path FROM documents WHERE owner_id = $1`, [req.user.id]);
    const docs = docsResult.rows;

    for (const doc of docs) {
      if (doc.file_path) {
        const fullPath = path.join(__dirname, '..', doc.file_path);
        fs.unlink(fullPath, (err) => {
          if (err) console.error('Error borrando archivo:', err);
        });
      }
    }

    await db.query(`DELETE FROM documents WHERE owner_id = $1`, [req.user.id]);

    return res.json({ ok: true, message: 'Se eliminaron documentos y archivos PDF' });
  } catch (err) {
    console.error('Error eliminando documentos:', err);
    return res.status(500).json({ ok: false, message: 'Error al eliminar documentos' });
  }
});

module.exports = router;

