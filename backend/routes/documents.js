// backend/routes/documents.js
const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("./auth");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const documentsController = require("../controllers/documentsController");
const db = require("../db");
const { sellarPdfConQr } = require("../services/pdfSeal");

const router = express.Router();

/* ================================
   RUTAS GET - ESPECÍFICAS (SIN PARÁMETROS)
   ================================ */

/**
 * @swagger
 * /api/docs/analytics:
 *   get:
 *     summary: Obtener métricas de documentos del usuario autenticado
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas de documentos
 */
router.get("/analytics", requireAuth, documentsController.getDocumentAnalytics);

/**
 * @swagger
 * /api/docs/export/reporte:
 *   get:
 *     summary: Descargar reporte PDF de documentos del usuario autenticado
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/export/reporte",
  requireAuth,
  documentsController.downloadReportPdf
);

/**
 * @swagger
 * /api/docs/export/excel:
 *   get:
 *     summary: Exportar listado de documentos a Excel
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo Excel
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/excel", requireAuth, async (req, res) => {
  try {
    const { generarExcelDocumentos } = require("../services/excelExport");
    const excelBuffer = await generarExcelDocumentos(req.user.id);

    const filename = `documentos-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error("❌ Error exportando Excel de documentos:", error);
    return res
      .status(500)
      .json({ error: "Error exportando Excel de documentos" });
  }
});

/* ================================
   RUTAS GET - LISTADOS (SIN PARÁMETROS)
   ================================ */

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Listar documentos del usuario autenticado
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de documentos
 */
router.get("/", requireAuth, documentsController.listDocuments);

/* ================================
   RUTAS POST - ESPECIALES (SIN PARÁMETROS)
   ================================ */

/**
 * @swagger
 * /api/docs:
 *   post:
 *     summary: Crear documento simple (subida de PDF)
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Documento creado
 */
router.post(
  "/",
  requireAuth,
  upload.single("file"),
  handleMulterError,
  documentsController.createDocument
);

/**
 * @swagger
 * /api/docs/recordatorios-automaticos:
 *   post:
 *     summary: Ejecutar proceso de recordatorios automáticos (cron manual)
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recordatorios procesados
 */
router.post(
  "/recordatorios-automaticos",
  requireAuth,
  documentsController.sendAutomaticReminders
);

/* ================================
   RUTAS POST - FLUJO DE FIRMA (tabla documents)
   ================================ */

/**
 * @swagger
 * /api/docs/crear-flujo:
 *   post:
 *     summary: Crear nuevo flujo de firma (tabla documents + document_signers)
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               signers:
 *                 type: string
 *                 description: JSON de firmantes y visadores
 *     responses:
 *       201:
 *         description: Flujo de firma creado
 */
router.post(
  "/crear-flujo",
  requireAuth,
  upload.single("file"),
  handleMulterError,
  async (req, res) => {
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const { title, description, signers } = req.body;
      const userId = req.user.id;

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Archivo PDF es requerido" });
      }

      const parsedSigners = JSON.parse(signers || "[]");
      if (!parsedSigners.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Debes enviar al menos un firmante/visador" });
      }

      const fileBuffer = req.file.buffer;
      const fileHash = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      const insertDocRes = await client.query(
        `
        INSERT INTO documents (
          owner_id,
          title,
          description,
          file_hash,
          status,
          created_at,
          updated_at,
          last_reminder_sent_at,
          resend_count,
          max_resends
        )
        VALUES ($1, $2, $3, $4, 'PENDIENTE_VISADO', NOW(), NOW(), NULL, 0, 3)
        RETURNING id
      `,
        [userId, title, description, fileHash]
      );

      const documentId = insertDocRes.rows[0].id;

      for (const signer of parsedSigners) {
        await client.query(
          `
          INSERT INTO document_signers (
            document_id,
            name,
            email,
            role,
            order_index,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', NOW(), NOW())
        `,
          [
            documentId,
            signer.name,
            signer.email,
            signer.role,
            signer.order_index || 0,
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        id: documentId,
        message: "Flujo de firma creado correctamente",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Error creando flujo de firma:", error);
      return res
        .status(500)
        .json({ error: "Error creando flujo de firma de documento" });
    } finally {
      client.release();
    }
  }
);

/**
 * @swagger
 * /api/docs/firmar-flujo/{id}:
 *   post:
 *     summary: Firmar/visar un paso del flujo de firma
 *     tags:
 *       - Documentos
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
 *               signerId:
 *                 type: integer
 *               tipo:
 *                 type: string
 *                 enum: [VISADO, FIRMA]
 *     responses:
 *       200:
 *         description: Paso de flujo firmado/visado
 */
router.post("/firmar-flujo/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { signerId, tipo } = req.body;
  const userId = req.user.id;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const docRes = await client.query(
      "SELECT * FROM documents WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (docRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const document = docRes.rows[0];

    if (document.status === "RECHAZADO") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "No se puede firmar un documento rechazado" });
    }

    const signerRes = await client.query(
      `
        SELECT *
        FROM document_signers
        WHERE id = $1
          AND document_id = $2
        FOR UPDATE
      `,
      [signerId, id]
    );

    if (signerRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Firmante/visador no encontrado" });
    }

    const signer = signerRes.rows[0];

    if (signer.status === "FIRMADO") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Este paso ya fue firmado/visado" });
    }

    await client.query(
      `
        UPDATE document_signers
        SET status = 'FIRMADO',
            updated_at = NOW()
        WHERE id = $1
      `,
      [signerId]
    );

    const allSignedRes = await client.query(
      `
        SELECT COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados,
               COUNT(*) AS total
        FROM document_signers
        WHERE document_id = $1
      `,
      [id]
    );

    const { firmados, total } = allSignedRes.rows[0];
    const allSigned = Number(firmados) === Number(total);

    if (allSigned) {
      await client.query(
        `
          UPDATE documents
          SET status = 'FIRMADO',
              updated_at = NOW()
          WHERE id = $1
        `,
        [id]
      );

      // aquí podrías llamar a sellarPdfConQr si quieres sellar al completar
      // await sellarPdfConQr(id);
    }

    await client.query("COMMIT");

    return res.json({
      message: "Paso del flujo firmado/visado correctamente",
      allSigned,
      progress: {
        firmados: Number(firmados),
        total: Number(total),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error firmando flujo de documento:", error);
    return res
      .status(500)
      .json({ error: "Error firmando flujo de documento" });
  } finally {
    client.release();
  }
});

/* ================================
   RUTAS GET - CON PARÁMETROS
   ================================ */

/**
 * @swagger
 * /api/docs/{id}/pdf:
 *   get:
 *     summary: Obtener PDF del documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get("/:id/pdf", requireAuth, documentsController.getDocumentPdf);

/**
 * @swagger
 * /api/docs/{id}/timeline:
 *   get:
 *     summary: Obtener timeline de eventos del documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get("/:id/timeline", requireAuth, documentsController.getTimeline);

/**
 * @swagger
 * /api/docs/{id}/signers:
 *   get:
 *     summary: Obtener firmantes/visadores del documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get("/:id/signers", requireAuth, documentsController.getSigners);

/**
 * @swagger
 * /api/docs/{id}/download:
 *   get:
 *     summary: Descargar PDF original del documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get("/:id/download", requireAuth, documentsController.downloadDocument);

/**
 * @swagger
 * /api/docs/{id}/reporte:
 *   get:
 *     summary: Descargar reporte PDF del documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  "/:id/reporte",
  requireAuth,
  documentsController.downloadDocumentReport
);

/* ================================
   RUTAS POST - CON PARÁMETROS
   ================================ */

/**
 * @swagger
 * /api/docs/{id}/firmar:
 *   post:
 *     summary: Firmar documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post("/:id/firmar", requireAuth, documentsController.signDocument);

/**
 * @swagger
 * /api/docs/{id}/visar:
 *   post:
 *     summary: Visar documento
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post("/:id/visar", requireAuth, documentsController.visarDocument);

/**
 * @swagger
 * /api/docs/{id}/rechazar:
 *   post:
 *     summary: Rechazar documento
 *     tags:
 *       - Documentos
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
 *                 description: Motivo del rechazo
 */
router.post("/:id/rechazar", requireAuth, documentsController.rejectDocument);

/**
 * @swagger
 * /api/docs/{id}/reenviar:
 *   post:
 *     summary: Reenviar recordatorio a firmante o visador
 *     tags:
 *       - Documentos
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
router.post("/:id/reenviar", requireAuth, documentsController.resendReminder);

/**
 * @swagger
 * /api/docs/{id}/recordatorio:
 *   post:
 *     summary: Enviar recordatorio manual al siguiente firmante/visador
 *     tags:
 *       - Documentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post("/:id/recordatorio", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const docRes = await db.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    if (docRes.rows[0].owner_id !== userId) {
      return res.status(403).json({ message: "No tienes permisos" });
    }

    const { enviarRecordatorioManual } = require("../services/reminderService");
    const result = await enviarRecordatorioManual(id);

    return res.json(result);
  } catch (err) {
    console.error("❌ Error enviando recordatorio:", err);
    return res
      .status(500)
      .json({ message: err.message || "Error enviando recordatorio" });
  }
});

/* ================================
   EXPORTAR ROUTER
   ================================ */

module.exports = router;
