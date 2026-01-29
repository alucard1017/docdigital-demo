// backend/routes/documents.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendReminderEmail } = require('../services/sendReminderEmails');
const { sendSignatureInviteEmail } = require('../services/sendSignatureInviteEmail');

const router = express.Router();

// Configuración de Multer para subida de PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});

// Límite de tamaño: 25 MB
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB
  }
});

// Middleware para capturar errores de Multer (tamaño, etc.)
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(413)
      .json({
        message: 'El archivo supera el tamaño máximo permitido (25 MB).'
      });
  }
  return next(err);
}

/**
 * GET /api/docs
 * Lista documentos del usuario autenticado
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { sort } = req.query;

    let orderByClause;
    switch (sort) {
      case 'fecha_desc':
        orderByClause = 'created_at DESC';
        break;
      case 'fecha_asc':
        orderByClause = 'created_at ASC';
        break;
      case 'id_desc':
        orderByClause = 'id DESC';
        break;
      case 'id_asc':
        orderByClause = 'id ASC';
        break;
      case 'title_desc':
        orderByClause = 'title DESC, id DESC';
        break;
      case 'title_asc':
      default:
        orderByClause = 'title ASC, id ASC';
        break;
    }

    const query = `
      SELECT
        id,
        owner_id,
        title,
        description,
        file_path,
        status,
        destinatario_nombre,
        destinatario_email,
        destinatario_movil,
        visador_nombre,
        visador_email,
        visador_movil,
        firmante_nombre,
        firmante_email,
        firmante_movil,
        firmante_run,
        empresa_rut,
        signature_status,
        requires_visado,
        reject_reason,
        created_at,
        updated_at
      FROM documents
      WHERE owner_id = $1
      ORDER BY ${orderByClause}
    `;

    const result = await db.query(query, [req.user.id]);

    const docs = result.rows.map((row) => ({
      ...row,
      requiresVisado: row.requires_visado === true,
      file_url: row.file_path
    }));

    return res.json(docs);
  } catch (err) {
    console.error('Error listando documentos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/docs
 * Crea un documento nuevo (requiere PDF)
 */
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
        requiresVisado
      } = req.body;

      console.log('BODY:', req.body);
      console.log('FILE:', req.file);

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
        return res.status(400).json({
          message:
            'Faltan campos obligatorios: título, representante legal y empresa'
        });
      }

      const filePath = '/uploads/' + req.file.filename;
      const requires_visado = requiresVisado === 'true';

      const signatureToken = crypto.randomUUID();
      const signatureExpiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ); // 7 días

      const insertQuery = `
        INSERT INTO documents (
          owner_id,
          title,
          description,
          file_path,
          status,
          destinatario_nombre,
          destinatario_email,
          destinatario_movil,
          visador_nombre,
          visador_email,
          visador_movil,
          firmante_nombre,
          firmante_email,
          firmante_movil,
          firmante_run,
          empresa_rut,
          requires_visado,
          signature_token,
          signature_token_expires_at,
          signature_status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20,
          NOW(), NOW()
        )
        RETURNING *;
      `;

      const insertValues = [
        req.user.id,
        title,
        description,
        filePath,
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
        firmante_run,
        empresa_rut,
        requires_visado,
        signatureToken,
        signatureExpiresAt,
        'PENDIENTE'
      ];

      const result = await db.query(insertQuery, insertValues);
      const doc = result.rows[0];

      await db.query(
        `
        INSERT INTO document_events (
          document_id,
          user_id,
          actor,
          action,
          details
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          doc.id,
          req.user.id,
          req.user.name || 'Sistema',
          'CREADO',
          'Documento creado y enviado a firma'
        ]
      );

      const frontBaseUrl =
        process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';
      const signUrl = `${frontBaseUrl}/?token=${signatureToken}`;

      await sendSignatureInviteEmail({
        signer_email: firmante_email,
        signer_name: firmante_nombre_completo,
        document_title: title,
        sign_url: signUrl
      });

      return res.status(201).json({
        ...doc,
        requiresVisado: doc.requires_visado === true,
        file_url: doc.file_path
      });
    } catch (err) {
      console.error('Error creando documento DETALLE:', err);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

/**
 * POST /api/docs/:id/firmar
 */
router.post('/:id/firmar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({
        message: 'El documento ya está firmado y no puede modificarse'
      });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({
        message: 'El documento fue rechazado y no puede modificarse'
      });
    }

    const oldStatus = docActual.status;

    const updateQuery = `
      UPDATE documents
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND owner_id = $3
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [
      'FIRMADO',
      id,
      req.user.id
    ]);

    const doc = result.rows[0];

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        user_id,
        actor,
        action,
        details,
        from_status,
        to_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        doc.id,
        req.user.id,
        req.user.name || 'Sistema',
        'FIRMADO',
        'Documento firmado por el owner',
        oldStatus,
        'FIRMADO'
      ]
    );

    return res.json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path
    });
  } catch (err) {
    console.error('Error firmando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/docs/:id/visar
 */
router.post('/:id/visar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({
        message: 'El documento ya está firmado y no puede modificarse'
      });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({
        message: 'El documento fue rechazado y no puede modificarse'
      });
    }

    if (docActual.status !== 'PENDIENTE') {
      return res.status(400).json({
        message: 'Solo se pueden visar documentos en estado PENDIENTE'
      });
    }

    const oldStatus = docActual.status;

    const updateQuery = `
      UPDATE documents
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND owner_id = $3
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [
      'VISADO',
      id,
      req.user.id
    ]);

    const doc = result.rows[0];

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        user_id,
        actor,
        action,
        details,
        from_status,
        to_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        doc.id,
        req.user.id,
        req.user.name || 'Sistema',
        'VISADO',
        'Documento visado',
        oldStatus,
        'VISADO'
      ]
    );

    return res.json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path
    });
  } catch (err) {
    console.error('Error visando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/docs/:id/rechazar
 */
router.post('/:id/rechazar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { motivo } = req.body;

    if (!motivo) {
      return res
        .status(400)
        .json({ message: 'El motivo de rechazo es obligatorio' });
    }

    const current = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({
        message: 'El documento ya está firmado y no puede modificarse'
      });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({
        message: 'El documento ya fue rechazado y no puede modificarse'
      });
    }

    const oldStatus = docActual.status;

    const updateQuery = `
      UPDATE documents
      SET status = $1,
          reject_reason = $2,
          updated_at = NOW()
      WHERE id = $3 AND owner_id = $4
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [
      'RECHAZADO',
      motivo,
      id,
      req.user.id
    ]);

    const doc = result.rows[0];

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        user_id,
        actor,
        action,
        details,
        from_status,
        to_status,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        doc.id,
        req.user.id,
        req.user.name || 'Sistema',
        'RECHAZADO',
        'Documento rechazado',
        oldStatus,
        'RECHAZADO',
        motivo
      ]
    );

    return res.json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path
    });
  } catch (err) {
    console.error('Error rechazando documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * GET /api/docs/:id/events
 */
router.get('/:id/events', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const docCheck = await db.query(
      'SELECT id FROM documents WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (docCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const eventsResult = await db.query(
      `
      SELECT
        id,
        action,
        details,
        created_at
      FROM document_events
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    return res.json(eventsResult.rows);
  } catch (err) {
    console.error('Error obteniendo eventos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/docs/:id/reminder
 */
router.post('/:id/reminder', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT id, title AS nombre, firmante_email AS signer_email
       FROM documents
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const doc = current.rows[0];

    const ok = await sendReminderEmail({
      id: doc.id,
      nombre: doc.nombre,
      signer_email: doc.signer_email
    });

    if (!ok) {
      return res.status(500).json({ message: 'No se pudo enviar el recordatorio' });
    }

    return res.json({ message: 'Recordatorio enviado correctamente' });
  } catch (err) {
    console.error('Error enviando recordatorio:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * GET /api/docs/public/sign/:token
 */
router.get('/public/sign/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `
      SELECT
        id,
        title,
        file_path,
        firmante_nombre,
        firmante_email,
        firmante_run,
        empresa_rut,
        destinatario_nombre,
        destinatario_email,
        signature_status,
        signature_token_expires_at
      FROM documents
      WHERE signature_token = $1
      `,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Enlace de firma no válido' });
    }

    const doc = result.rows[0];

    if (
      doc.signature_token_expires_at &&
      new Date(doc.signature_token_expires_at) < new Date()
    ) {
      return res
        .status(410)
        .json({ message: 'El enlace de firma ha expirado' });
    }

    return res.json({
      id: doc.id,
      title: doc.title,
      file_url: doc.file_path,
      firmante_nombre: doc.firmante_nombre,
      firmante_email: doc.firmante_email,
      firmante_run: doc.firmante_run,
      empresa_rut: doc.empresa_rut,
      destinatario_nombre: doc.destinatario_nombre,
      destinatario_email: doc.destinatario_email,
      signature_status: doc.signature_status
    });
  } catch (err) {
    console.error('Error obteniendo info pública de firma:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/docs/public/sign/:token/confirm
 */
router.post('/public/sign/:token/confirm', async (req, res) => {
  try {
    const { token } = req.params;

    const current = await db.query(
      `
      SELECT
        id,
        status,
        signature_status,
        signature_token_expires_at
      FROM documents
      WHERE signature_token = $1
      `,
      [token]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Enlace de firma no válido' });
    }

    const docActual = current.rows[0];

    if (
      docActual.signature_token_expires_at &&
      new Date(docActual.signature_token_expires_at) < new Date()
    ) {
      return res
        .status(410)
        .json({ message: 'El enlace de firma ha expirado' });
    }

    if (docActual.signature_status === 'FIRMADO') {
      return res
        .status(400)
        .json({ message: 'El documento ya fue firmado por el representante' });
    }

    const updateQuery = `
      UPDATE documents
      SET
        signature_status = 'FIRMADO',
        status = 'FIRMADO',
        updated_at = NOW()
      WHERE signature_token = $1
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [token]);
    const doc = result.rows[0];

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        user_id,
        actor,
        action,
        details,
        from_status,
        to_status
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6)
      `,
      [
        doc.id,
        'Representante Legal',
        'FIRMADO_REPRESENTANTE',
        'Documento firmado mediante enlace externo',
        docActual.status,
        'FIRMADO'
      ]
    );

    return res.json({ message: 'Firma registrada correctamente' });
  } catch (err) {
    console.error('Error confirmando firma pública:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/docs
 * Elimina TODOS los documentos del usuario autenticado
 * y borra sus archivos PDF del disco
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const docsResult = await db.query(
      'SELECT file_path FROM documents WHERE owner_id = $1',
      [req.user.id]
    );

    const docs = docsResult.rows;

    for (const doc of docs) {
      if (doc.file_path) {
        const fullPath = path.join(__dirname, '..', doc.file_path);
        fs.unlink(fullPath, (err) => {
          if (err) console.error('Error borrando archivo:', err);
        });
      }
    }

    await db.query('DELETE FROM documents WHERE owner_id = $1', [
      req.user.id
    ]);

    return res.json({
      ok: true,
      message: 'Se eliminaron documentos y archivos PDF'
    });
  } catch (err) {
    console.error('Error eliminando documentos:', err);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al eliminar documentos' });
  }
});

module.exports = router;
