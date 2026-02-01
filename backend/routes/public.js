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
      return res
        .status(404)
        .json({ message: 'Enlace inválido o documento no encontrado' });
    }

    const doc = result.rows[0];

    if (
      doc.signature_token_expires_at &&
      doc.signature_token_expires_at < new Date()
    ) {
      return res
        .status(400)
        .json({ message: 'El enlace de firma ha expirado' });
    }

    if (!doc.file_path) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    const pdfUrl = await getSignedUrl(doc.file_path, 3600);

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

/* ================================
   POST: Firmar documento por token
   ================================ */
router.post('/docs/:token/firmar', async (req, res) => {
  try {
    const { token } = req.params;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE signature_token = $1`,
      [token]
    );

    if (current.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Enlace inválido o documento no encontrado' });
    }

    const docActual = current.rows[0];

    if (
      docActual.signature_token_expires_at &&
      docActual.signature_token_expires_at < new Date()
    ) {
      return res
        .status(400)
        .json({ message: 'El enlace de firma ha expirado' });
    }

    if (docActual.signature_status === 'FIRMADO') {
      return res
        .status(400)
        .json({ message: 'Este documento ya fue firmado' });
    }

    if (docActual.status === 'RECHAZADO') {
      return res
        .status(400)
        .json({ message: 'Documento rechazado, no se puede firmar' });
    }

    if (docActual.requires_visado === true && docActual.status === 'PENDIENTE') {
      return res.status(400).json({
        message: 'Este documento requiere visación antes de firmar',
      });
    }

    const result = await db.query(
      `UPDATE documents
       SET signature_status = $1,
           status = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      ['FIRMADO', 'FIRMADO', docActual.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        doc.firmante_nombre || 'Firmante externo',
        'FIRMADO_PUBLICO',
        'Documento firmado desde enlace público',
        docActual.status,
        'FIRMADO',
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento firmado correctamente desde enlace público',
    });
  } catch (err) {
    console.error('❌ Error firmando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   EXPORTAR ROUTER
   ================================ */
module.exports = router;
