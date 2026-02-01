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
         id,
         title,
         status,
         file_path,
         destinatario_nombre,
         empresa_rut,
         firmante_nombre,
         firmante_run,
         requires_visado,
         signature_status,
         signature_token_expires_at
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
    const pdfUrl = await getSignedUrl(doc.file_path, 3600); // presigned URL S3 [web:184]

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        firmante_nombre: doc.firmante_nombre,
        firmante_run: doc.firmante_run,
        requires_visado: doc.requires_visado,
        signature_status: doc.signature_status,
      },
      pdfUrl,
    });
  } catch (err) {
    console.error('❌ Error cargando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
