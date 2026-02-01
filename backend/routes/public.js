// backend/routes/public.js
const express = require('express');
const db = require('../db');
const { getSignedUrl } = require('../services/s3');

const router = express.Router();

/* ================================
   GET: Datos + PDF para enlace público
   ================================ */
router.get('/docs/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT 
         id, title, status, file_path,
         destinatario_nombre, empresa_rut,
         firmante_nombre, signature_token_expires_at,
         requires_visado
       FROM documents
       WHERE signature_token = $1`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Enlace inválido o documento no encontrado' });
    }

    const doc = result.rows[0];

    if (doc.signature_token_expires_at && doc.signature_token_expires_at < new Date()) {
      return res.status(400).json({ message: 'El enlace de firma ha expirado' });
    }

    if (!doc.file_path) {
      return res.status(404).json({ message: 'Documento sin archivo asociado' });
    }

    // URL firmada para ver el PDF
    const pdfUrl = await getSignedUrl(doc.file_path, 3600); // [web:184]

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        firmante_nombre: doc.firmante_nombre,
        requires_visado: doc.requires_visado,
      },
      pdfUrl,
    });
  } catch (err) {
    console.error('❌ Error cargando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Firmar documento desde enlace público
   ================================ */
router.post('/docs/:token/firmar', async (req, res) => {
  try {
    const { token } = req.params;

    const current = await db.query(
      `SELECT * FROM documents WHERE signature_token = $1`,
      [token]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Enlace inválido o documento no encontrado' });
    }

    const docActual = current.rows[0];

    if (docActual.signature_token_expires_at && docActual.signature_token_expires_at < new Date()) {
      return res.status(400).json({ message: 'El enlace de firma ha expirado' });
    }

    if (docActual.status === 'FIRMADO') {
      return res.status(400).json({ message: 'El documento ya está firmado' });
    }

    if (docActual.status === 'RECHAZADO') {
      return res.status(400).json({ message: 'El documento fue rechazado' });
    }

    // Si requiere visado y aún está PENDIENTE, no debería firmarse
    if (docActual.requires_visado === true && docActual.status === 'PENDIENTE') {
      return res.status(400).json({
        message: 'Este documento requiere visación antes de firmar',
      });
    }

    const updated = await db.query(
      `UPDATE documents
       SET status = $1,
           signature_status = 'FIRMADO',
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, title, status`,
      ['FIRMADO', docActual.id]
    );

    const doc = updated.rows[0];

    await db.query(
      `INSERT INTO document_events 
         (document_id, actor, action, details, from_status, to_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        docActual.firmante_nombre || 'Firmante enlace público',
        'FIRMADO_PUBLICO',
        'Documento firmado desde enlace público',
        docActual.status,
        'FIRMADO',
      ]
    );

    return res.json({
      document: doc,
      message: 'Documento firmado correctamente',
    });
  } catch (err) {
    console.error('❌ Error firmando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
