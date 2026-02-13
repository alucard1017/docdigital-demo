// backend/routes/documents.js
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('./auth');
const { upload, handleMulterError } = require('../middlewares/uploadPdf');
const documentsController = require('../controllers/documentsController');
const db = require('../db');
const { sellarPdfConQr } = require('../services/pdfSeal');

const router = express.Router();

/* ================================
   RUTAS GET - LECTURA
   ================================ */
router.get('/', requireAuth, documentsController.getUserDocuments);
router.get('/:id/pdf', documentsController.getDocumentPdf);
router.get('/:id/timeline', documentsController.getTimeline);
router.get('/:id/signers', requireAuth, documentsController.getSigners);
router.get('/:id/download', documentsController.downloadDocument);

/* ================================
   RUTAS ESPECÍFICAS - ANTES DE :id
   ================================ */
router.get('/export/excel', requireAuth, async (req, res) => {
  try {
    const { generarExcelDocumentos } = require('../services/excelExport');

    const excelBuffer = await generarExcelDocumentos(req.user.id);

    const filename = `documentos-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    res.send(excelBuffer);
  } catch (err) {
    console.error('❌ Error exportando Excel:', err);
    return res.status(500).json({ message: 'Error exportando reporte' });
  }
});

/* ================================
   RUTAS POST - CREACIÓN / MODIFICACIÓN
   ================================ */
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  handleMulterError,
  documentsController.createDocument
);

router.post('/:id/firmar', requireAuth, documentsController.signDocument);
router.post('/:id/visar', requireAuth, documentsController.visarDocument);
router.post('/:id/rechazar', requireAuth, documentsController.rejectDocument);
router.post('/:id/reenviar', requireAuth, documentsController.resendReminder);

/* ================================
   POST: Enviar recordatorio manual
   ================================ */
router.post('/:id/recordatorio', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const docRes = await db.query(
      `SELECT owner_id FROM documents WHERE id = $1`,
      [id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    if (docRes.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const { enviarRecordatorioManual } = require('../services/reminderService');
    const result = await enviarRecordatorioManual(id);

    return res.json(result);
  } catch (err) {
    console.error('❌ Error enviando recordatorio:', err);
    return res
      .status(500)
      .json({ message: err.message || 'Error enviando recordatorio' });
  }
});

/* ================================
   FLUJO NUEVO: crear registro documentos/firmantes
   ================================ */
router.post('/crear-flujo', requireAuth, async (req, res) => {
  console.log('DEBUG crear-flujo body >>>', req.body);

  const { tipo, titulo, categoriaFirma, firmantes } = req.body;

  if (!tipo || !titulo || !categoriaFirma || !Array.isArray(firmantes)) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    await db.query('BEGIN');

    const codigoVerificacion = crypto.randomUUID().slice(0, 8);

    const docResult = await db.query(
      `INSERT INTO documentos (tipo, titulo, estado, hash_pdf, codigo_verificacion, categoria_firma)
       VALUES ($1, $2, 'BORRADOR', NULL, $3, $4)
       RETURNING *`,
      [tipo, titulo, codigoVerificacion, categoriaFirma]
    );

    const documento = docResult.rows[0];

    for (const [index, f] of firmantes.entries()) {
      await db.query(
        `INSERT INTO firmantes (documento_id, nombre, email, rut, rol, orden_firma)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          documento.id,
          f.nombre,
          f.email,
          f.rut || null,
          f.rol || null,
          f.ordenFirma ?? index + 1,
        ]
      );
    }

    await db.query(
      `INSERT INTO eventos_firma (documento_id, tipo_evento, metadata)
       VALUES ($1, 'CREADO', $2)`,
      [documento.id, { fuente: 'API' }]
    );

    await db.query('COMMIT');

    return res.status(201).json({
      documentoId: documento.id,
      codigoVerificacion,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error creando flujo de documento', error);
    return res.status(500).json({ error: 'Error creando flujo de documento' });
  }
});

/* ================================
   FLUJO NUEVO: firmar en el nuevo flujo
   ================================ */
router.post('/firmar-flujo/:firmanteId', requireAuth, async (req, res) => {
  const { firmanteId } = req.params;

  try {
    const firmanteRes = await db.query(
      `SELECT f.*, d.id AS documento_id, d.estado AS documento_estado
       FROM firmantes f
       JOIN documentos d ON d.id = f.documento_id
       WHERE f.id = $1`,
      [firmanteId]
    );

    if (firmanteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Firmante no encontrado' });
    }

    const firmante = firmanteRes.rows[0];

    if (firmante.estado === 'FIRMADO') {
      return res.status(400).json({ error: 'Este firmante ya firmó' });
    }

    await db.query('BEGIN');

    await db.query(
      `UPDATE firmantes
       SET estado = 'FIRMADO',
           fecha_firma = NOW(),
           tipo_firma = 'SIMPLE'
       WHERE id = $1`,
      [firmanteId]
    );

    await db.query(
      `INSERT INTO eventos_firma (documento_id, firmante_id, tipo_evento, ip, user_agent, metadata)
       VALUES ($1, $2, 'FIRMADO', $3, $4, $5)`,
      [
        firmante.documento_id,
        firmanteId,
        req.ip || null,
        req.headers['user-agent'] || null,
        { fuente: 'API', via: 'firmar-flujo' },
      ]
    );

    const countRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE estado = 'FIRMADO') AS firmados,
         COUNT(*) AS total
       FROM firmantes
       WHERE documento_id = $1`,
      [firmante.documento_id]
    );

    const { firmados, total } = countRes.rows[0];
    const allSigned = Number(firmados) >= Number(total);

    if (allSigned) {
      await db.query(
        `UPDATE documentos
         SET estado = 'FIRMADO',
             updated_at = NOW()
         WHERE id = $1`,
        [firmante.documento_id]
      );

      await db.query(
        `INSERT INTO eventos_firma (documento_id, tipo_evento, metadata)
         VALUES ($1, 'DOCUMENTO_FIRMADO_COMPLETO', $2)`,
        [
          firmante.documento_id,
          { descripcion: 'Todos los firmantes han firmado' },
        ]
      );
    }

    await db.query('COMMIT');

    return res.json({
      mensaje: allSigned
        ? 'Firma registrada y documento completado'
        : 'Firma registrada',
      documentoId: firmante.documento_id,
      firmanteId,
      allSigned,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error firmando flujo de documento:', error);
    return res.status(500).json({ error: 'Error firmando flujo de documento' });
  }
});

module.exports = router;
