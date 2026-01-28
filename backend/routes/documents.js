// backend/routes/documents.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('./auth');
const { sendReminderEmail } = require('../services/sendReminderEmails');

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

    console.log('SORT LLEGÓ:', sort, 'ORDER BY:', orderByClause);

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
        firmante_nombre,
        firmante_email,
        firmante_movil,
        requiresVisado
      } = req.body;

      console.log('BODY:', req.body);
      console.log('FILE:', req.file);

      if (!req.file) {
        return res
          .status(400)
          .json({ message: 'El archivo PDF es obligatorio' });
      }

      // Validar campos esenciales
      if (
        !title ||
        !firmante_nombre ||
        !firmante_email ||
        !destinatario_nombre ||
        !destinatario_email
      ) {
        return res.status(400).json({
          message:
            'Faltan campos obligatorios: título, firmante y destinatario'
        });
      }

      const filePath = '/uploads/' + req.file.filename;
      const requires_visado = requiresVisado === 'true';

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
          requires_visado,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15,
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
        firmante_nombre,
        firmante_email,
        firmante_movil,
        requires_visado
      ];

      const result = await db.query(insertQuery, insertValues);
      const doc = result.rows[0];

      // Registrar evento de creación (id + actor)
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
 * Marca un documento como FIRMADO
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

    // Registrar evento de firma
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
 * Marca un documento como VISADO
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

    // Registrar evento de visado
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
 * Marca un documento como RECHAZADO con motivo
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

    // Registrar evento de rechazo
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
 * Devuelve el historial de eventos del documento
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
 * Envía un correo de recordatorio para un documento
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

module.exports = router;
