// backend/routes/public.js
const express = require('express');
const db = require('../db');
const { getSignedUrl } = require('../services/s3');

const router = express.Router();

/* ================================
   GET: Datos + PDF para enlace público (consulta/firma/visado)
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
         signature_token_expires_at,
         required_signers,
         signed_count
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
      return res.status(400).json({
        message: 'El enlace público ha expirado, solicita uno nuevo al emisor',
      });
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
        required_signers: doc.required_signers,
        signed_count: doc.signed_count,
      },
      pdfUrl,
    });
  } catch (err) {
    console.error('❌ Error cargando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Firmar documento por token (firmante externo)
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

    if (docActual.status === 'RECHAZADO') {
      return res
        .status(400)
        .json({ message: 'Documento rechazado, no se puede firmar' });
    }

    if (docActual.requires_visado === true && docActual.status === 'PENDIENTE_VISADO') {
      return res.status(400).json({
        message: 'Este documento requiere visación antes de firmar',
      });
    }

    // Contador de firmas: incrementamos y vemos si ya firmaron todos
    const currentSigned = docActual.signed_count || 0;
    const required = docActual.required_signers || 1;
    const newSignedCount = currentSigned + 1;
    const allSigned = newSignedCount >= required;

    // Si ya estaba marcado firmado, no dejamos volver a firmar
    if (docActual.signature_status === 'FIRMADO' && allSigned) {
      return res
        .status(400)
        .json({ message: 'Este documento ya fue firmado por todos los firmantes' });
    }

    const result = await db.query(
      `UPDATE documents
       SET signature_status = $1,
           status = $2,
           signed_count = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        allSigned ? 'FIRMADO' : 'PENDIENTE',
        allSigned ? 'FIRMADO' : 'PENDIENTE_FIRMA',
        newSignedCount,
        docActual.id,
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
        doc.firmante_nombre || 'Firmante externo',
        'FIRMADO_PUBLICO',
        allSigned
          ? 'Documento firmado por todos los firmantes desde enlace público'
          : 'Documento firmado parcialmente desde enlace público',
        docActual.status,
        doc.status,
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: allSigned
        ? 'Documento firmado correctamente por todos los firmantes'
        : 'Firma registrada. Aún faltan firmantes por completar la firma',
    });
  } catch (err) {
    console.error('❌ Error firmando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Visar documento por token (visador externo)
   ================================ */
router.post('/docs/:token/visar', async (req, res) => {
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
        .json({ message: 'El enlace de visado ha expirado' });
    }

    if (docActual.status === 'RECHAZADO') {
      return res
        .status(400)
        .json({ message: 'Documento rechazado, no se puede visar' });
    }

    if (docActual.requires_visado !== true) {
      return res
        .status(400)
        .json({ message: 'Este documento no requiere visación' });
    }

    if (docActual.status !== 'PENDIENTE_VISADO') {
      return res.status(400).json({
        message: 'Solo se pueden visar documentos en estado PENDIENTE_VISADO',
      });
    }

    const result = await db.query(
      `UPDATE documents
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      ['PENDIENTE_FIRMA', docActual.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        doc.visador_nombre || 'Visador externo',
        'VISADO_PUBLICO',
        'Documento visado desde enlace público',
        docActual.status,
        'PENDIENTE_FIRMA',
      ]
    );

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: 'Documento visado correctamente desde enlace público',
    });
  } catch (err) {
    console.error('❌ Error visando documento público:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   EXPORTAR ROUTER
   ================================ */
module.exports = router;
