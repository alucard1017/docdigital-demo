// backend/routes/public.js
const express = require('express');
const db = require('../db');
const { getSignedUrl } = require('../services/s3');
const { sellarPdfConQr } = require('../services/pdfSeal');

const router = express.Router();

/* ================================
   GET: Datos + PDF para enlace público de FIRMA (por firmante, sign_token)
   ================================ */
router.get('/docs/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT 
         d.id,
         d.title,
         d.status,
         d.file_path,
         d.destinatario_nombre,
         d.empresa_rut,
         d.requires_visado,
         d.signature_status,
         d.signature_token_expires_at,
         d.firmante_nombre,
         d.firmante_run,
         d.numero_contrato_interno,
         s.id AS signer_id,
         s.name AS signer_name,
         s.email AS signer_email,
         s.status AS signer_status
       FROM document_signers s
       JOIN documents d ON d.id = s.document_id
       WHERE s.sign_token = $1`,
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
        requires_visado: doc.requires_visado,
        signature_status: doc.signature_status,
        firmante_nombre: doc.firmante_nombre,
        firmante_run: doc.firmante_run,
        numero_contrato_interno: doc.numero_contrato_interno,
      },
      signer: {
        id: doc.signer_id,
        name: doc.signer_name,
        email: doc.signer_email,
        status: doc.signer_status,
      },
      pdfUrl,
    });
  } catch (err) {
    console.error('❌ Error cargando documento público (firmante):', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   GET: Datos + PDF usando signature_token del DOCUMENTO
   (para VISADO y consulta pública)
   ================================ */
router.get('/docs/document/:token', async (req, res) => {
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
         requires_visado,
         signature_status,
         signature_token_expires_at,
         firmante_nombre,
         firmante_run,
         numero_contrato_interno
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
      document: doc,
      pdfUrl,
    });
  } catch (err) {
    console.error('❌ Error cargando documento público (document):', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ================================
   POST: Firmar documento por token (firmante externo, por sign_token)
   ================================ */
router.post('/docs/:token/firmar', async (req, res) => {
  try {
    const { token } = req.params;

    const current = await db.query(
      `SELECT 
         s.id AS signer_id,
         s.status AS signer_status,
         s.name AS signer_name,
         s.email AS signer_email,
         d.*
       FROM document_signers s
       JOIN documents d ON d.id = s.document_id
       WHERE s.sign_token = $1`,
      [token]
    );

    if (current.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Enlace inválido o documento no encontrado' });
    }

    const row = current.rows[0];

    if (
      row.signature_token_expires_at &&
      row.signature_token_expires_at < new Date()
    ) {
      return res
        .status(400)
        .json({ message: 'El enlace de firma ha expirado' });
    }

    if (row.status === 'RECHAZADO') {
      return res
        .status(400)
        .json({ message: 'Documento rechazado, no se puede firmar' });
    }

    if (row.requires_visado === true && row.status === 'PENDIENTE_VISADO') {
      return res.status(400).json({
        message: 'Este documento requiere visación antes de firmar',
      });
    }

    if (row.signer_status === 'FIRMADO') {
      return res
        .status(400)
        .json({ message: 'Este firmante ya firmó el documento' });
    }

    await db.query(
      `UPDATE document_signers
       SET status = 'FIRMADO',
           signed_at = NOW()
       WHERE id = $1`,
      [row.signer_id]
    );

    const countRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'FIRMADO') AS signed_count,
         COUNT(*) AS total_signers
       FROM document_signers
       WHERE document_id = $1`,
      [row.id]
    );

    const { signed_count, total_signers } = countRes.rows[0];
    const allSigned = Number(signed_count) >= Number(total_signers);

    let newDocStatus = row.status;
    let newSignatureStatus = row.signature_status;

    if (allSigned) {
      newDocStatus = 'FIRMADO';
      newSignatureStatus = 'FIRMADO';
    } else {
      newDocStatus = 'PENDIENTE_FIRMA';
      newSignatureStatus = 'PENDIENTE';
    }

    const docUpdateRes = await db.query(
      `UPDATE documents
       SET status = $1,
           signature_status = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newDocStatus, newSignatureStatus, row.id]
    );
    const doc = docUpdateRes.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        row.signer_name || 'Firmante externo',
        'FIRMADO_PUBLICO',
        allSigned
          ? 'Documento firmado por todos los firmantes desde enlace público'
          : `Firma registrada para firmante ${row.signer_email}`,
        row.status,
        newDocStatus,
      ]
    );

    // Si TODOS firmaron y el documento está vinculado al flujo nuevo, sellar PDF FINAL
    if (allSigned && doc.nuevo_documento_id) {
      try {
        const docNuevoRes = await db.query(
          `SELECT id, codigo_verificacion, categoria_firma
           FROM documentos
           WHERE id = $1`,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];

          const baseKey = doc.pdf_original_url || doc.file_path;

          const newKey = await sellarPdfConQr({
            s3Key: baseKey,
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
        console.error('⚠️ Error sellando PDF con QR (firma pública):', sealError);
      }
    }

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
   GET: Verificación por código
   ================================ */
router.get('/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const docResult = await db.query(
      `SELECT *
       FROM documentos
       WHERE codigo_verificacion = $1`,
      [codigo]
    );

    if (docResult.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado para este código' });
    }

    const documento = docResult.rows[0];

    const signersResult = await db.query(
      `SELECT id, nombre, email, rut, rol, orden_firma, estado, fecha_firma, tipo_firma
       FROM firmantes
       WHERE documento_id = $1
       ORDER BY orden_firma ASC`,
      [documento.id]
    );

    const eventosResult = await db.query(
      `SELECT id, tipo_evento, ip, user_agent, metadata, created_at
       FROM eventos_firma
       WHERE documento_id = $1
       ORDER BY created_at ASC`,
      [documento.id]
    );

    return res.json({
      codigoVerificacion: documento.codigo_verificacion,
      documento: {
        id: documento.id,
        tipo: documento.tipo,
        titulo: documento.titulo,
        estado: documento.estado,
        categoria_firma: documento.categoria_firma,
        hash_pdf: documento.hash_pdf,
        created_at: documento.created_at,
        updated_at: documento.updated_at,
      },
      firmantes: signersResult.rows,
      eventos: eventosResult.rows,
    });
  } catch (err) {
    console.error('❌ Error en verificación por código:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
