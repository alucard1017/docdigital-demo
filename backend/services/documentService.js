// backend/routes/documents.js

const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

const requireAuth = require('../middleware/requireAuth'); // ajusta la ruta si es distinta
const documentService = require('../services/documentService');

// Configuración de Multer para subir PDFs a /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  },
});

const upload = multer({ storage });

/**
 * GET /api/docs
 * Lista de documentos del usuario autenticado.
 */
router.get('/', requireAuth, (req, res) => {
  const ownerId = req.user.id;

  documentService.listarDocumentos(ownerId, (err, rows) => {
    if (err) {
      console.error('Error al listar documentos:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    return res.json(rows);
  });
});

/**
 * POST /api/docs
 * Crear un documento nuevo (con subida de archivo opcional).
 * Body: { title, description } + archivo (campo "file")
 */
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título es obligatorio.' });
    }

    // Ruta del archivo si se subió
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const data = {
      owner_id: req.user.id,
      title,
      description: description || '',
      file_path: filePath,
    };

    documentService.crearDocumento(data, (err, doc) => {
      if (err) {
        console.error('Error al crear documento:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      return res.status(201).json(doc);
    });
  } catch (error) {
    console.error('Error en POST /api/docs:', error);
    return res.status(500).json({ error: 'Error en el servidor.' });
  }
});

/**
 * GET /api/docs/:id
 * Detalle de un documento del usuario.
 */
router.get('/:id', requireAuth, (req, res) => {
  const ownerId = req.user.id;
  const docId = req.params.id;

  documentService.obtenerDocumento(ownerId, docId, (err, row) => {
    if (err) {
      console.error('Error al obtener documento:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.json(row);
  });
});

/**
 * PATCH /api/docs/:id/status
 * Actualizar el estado de un documento (ej: ENVIADO, COMPLETADO, RECHAZADO).
 * Body: { status, motivo? }
 */
router.patch('/:id/status', requireAuth, (req, res) => {
  const ownerId = req.user.id;
  const docId = req.params.id;
  const { status, motivo } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'El status es obligatorio.' });
  }

  documentService.actualizarEstadoDocumento(
    ownerId,
    docId,
    status,
    motivo || null,
    (err, updated) => {
      if (err) {
        console.error('Error al actualizar estado del documento:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      if (!updated) {
        return res.status(404).json({ error: 'No encontrado' });
      }
      return res.json({ message: 'Estado actualizado', documento: updated });
    }
  );
});

module.exports = router;
