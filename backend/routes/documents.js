// backend/routes/documents.js
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('./auth');
const { upload, handleMulterError } = require('../middlewares/uploadPdf');
const documentsController = require('../controllers/documentsController');
const db = require('../db');
const { sellarPdfConQr } = require('../services/pdfSeal');

const router = express.Router();

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Listar documentos del usuario
 *     description: Obtiene todos los documentos del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [title_asc, title_desc, fecha_desc, fecha_asc, numero_asc, numero_desc]
 *     responses:
 *       200:
 *         description: Lista de documentos
 */
router.get('/', requireAuth, documentsController.getUserDocuments);

/**
 * @swagger
 * /api/docs/{id}/pdf:
 *   get:
 *     summary: Obtener URL firmada del PDF
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: URL firmada del PDF
 */
router.get('/:id/pdf', documentsController.getDocumentPdf);

/**
 * @swagger
 * /api/docs/{id}/timeline:
 *   get:
 *     summary: Obtener timeline del documento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Timeline con eventos
 */
router.get('/:id/timeline', documentsController.getTimeline);

/**
 * @swagger
 * /api/docs/{id}/signers:
 *   get:
 *     summary: Listar firmantes de un documento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/:id/signers', requireAuth, documentsController.getSigners);

/**
 * @swagger
 * /api/docs/{id}/download:
 *   get:
 *     summary: Descargar PDF del documento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/:id/download', documentsController.downloadDocument);

/* ================================
   RUTAS ESPECÍFICAS - ANTES DE :id
   ================================ */

/**
 * @swagger
 * /api/docs/export/excel:
 *   get:
 *     summary: Exportar documentos a Excel
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo Excel con los documentos
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
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

/**
 * @swagger
 * /api/docs:
 *   post:
 *     summary: Crear nuevo documento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               firmante_email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Documento creado exitosamente
 */
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  handleMulterError,
  documentsController.createDocument
);

/**
 * @swagger
 * /api/docs/{id}/firmar:
 *   post:
 *     summary: Firmar documento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Documento firmado
 */
router.post('/:id/firmar', requireAuth, documentsController.signDocument);

/**
 * @swagger
 * /api/docs/{id}/visar:
 *   post:
 *     summary: Visar documento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/:id/visar', requireAuth, documentsController.visarDocument);

/**
 * @swagger
 * /api/docs/{id}/rechazar:
 *   post:
 *     summary: Rechazar documento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 */
router.post('/:id/rechazar', requireAuth, documentsController.rejectDocument);

/**
 * @swagger
 * /api/docs/{id}/reenviar:
 *   post:
 *     summary: Reenviar recordatorio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [VISADO, FIRMA]
 *               signerId:
 *                 type: integer
 */
router.post('/:id/reenviar', requireAuth, documentsController.resendReminder);

/**
 * @swagger
 * /api/docs/{id}/recordatorio:
 *   post:
 *     summary: Enviar recordatorio manual a todos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recordatorio(s) enviado(s)
 */
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

/**
 * @swagger
 * /api/docs/crear-flujo:
 *   post:
 *     summary: Crear nuevo flujo de firma (tabla documentos)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *               titulo:
 *                 type: string
 *               categoriaFirma:
 *                 type: string
 *               firmantes:
 *                 type: array
 */
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

/**
 * @swagger
 * /api/docs/firmar-flujo/{firmanteId}:
 *   post:
 *     summary: Firmar en nuevo flujo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: firmanteId
 *         required: true
 *         schema:
 *           type: integer
 */
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
