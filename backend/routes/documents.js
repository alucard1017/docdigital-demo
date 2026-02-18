// backend/routes/documents.js
const express = require("express");
const crypto = require("crypto");
const Sentry = require("@sentry/node");
const { requireAuth } = require("./auth");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const documentsController = require("../controllers/documentsController");
const db = require("../db");
const { sellarPdfConQr } = require("../services/pdfSeal");

const router = express.Router();

/* ================================
   RATE LIMITING SIMPLE
   ================================ */

const rateLimit = {};

function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  
  if (!rateLimit[key]) {
    rateLimit[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }
  
  if (now > rateLimit[key].resetAt) {
    rateLimit[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }
  
  if (rateLimit[key].count >= maxAttempts) {
    return false;
  }
  
  rateLimit[key].count++;
  return true;
}

/* ================================
   MIDDLEWARE DE PERMISOS
   ================================ */

async function checkDocumentOwnership(req, res, next) {
  try {
    const { id } = req.params;
    
    const docRes = await db.query(
      `SELECT id, owner_id, titulo, estado 
       FROM documents 
       WHERE id = $1`,
      [id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    if (doc.owner_id !== req.user.id) {
      return res.status(403).json({ message: "No tienes permisos sobre este documento" });
    }

    // Contexto de documento cuando verificas ownership
    Sentry.setContext("document", {
      id: doc.id,
      owner_id: doc.owner_id,
      title: doc.titulo || undefined,
      status: doc.estado || undefined,
    });

    next();
  } catch (err) {
    console.error("❌ Error verificando permisos:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   MIDDLEWARE DE AUDITORÍA (SIMPLIFICADO - SIN ENUM)
   ================================ */

function logAuditAction(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Log solo si la operación fue exitosa
    if (res.statusCode < 400) {
      const { registrarAuditoria } = require("../utils/auditLog");
      
      registrarAuditoria({
        documento_id: req.params.id || null,
        usuario_id: req.user?.id || null,
        evento_tipo: "API_ACTION",
        descripcion: `${req.method} ${req.route?.path}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"] || null,
      }).catch(err => console.error("⚠️ Error logging audit:", err));
    }
    
    return originalJson(data);
  };
  
  next();
}

/* ================================
   RUTAS GET - ESPECÍFICAS (SIN PARÁMETROS)
   ================================ */

router.get("/analytics", requireAuth, documentsController.getDocumentAnalytics);

router.get("/export/excel", requireAuth, async (req, res) => {
  try {
    const { generarExcelDocumentos } = require("../services/excelExport");
    const excelBuffer = await generarExcelDocumentos(req.user.id);
    const filename = `documentos-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error("❌ Error exportando Excel:", error);
    return res.status(500).json({ error: "Error exportando Excel" });
  }
});

/* ================================
   RUTAS GET - LISTADOS (SIN PARÁMETROS)
   ================================ */

router.get("/", requireAuth, documentsController.getUserDocuments);

/* ================================
   RUTAS POST - ESPECIALES (SIN PARÁMETROS)
   ================================ */

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  handleMulterError,
  documentsController.createDocument
);

router.post(
  "/recordatorios-automaticos",
  requireAuth,
  (req, res, next) => {
    const key = `reminders_${req.user.id}`;
    if (!checkRateLimit(key, 3, 3600000)) { // 3 intentos por hora
      return res.status(429).json({ 
        message: "Demasiados intentos. Espera 1 hora antes de volver a enviar recordatorios." 
      });
    }
    next();
  },
  documentsController.sendAutomaticReminders
);

router.post("/crear-flujo", requireAuth, async (req, res) => {
  console.log("DEBUG crear-flujo body >>>", req.body);

  const { tipo, titulo, categoriaFirma, firmantes } = req.body;

  if (!tipo || !titulo || !categoriaFirma || !Array.isArray(firmantes)) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    await db.query("BEGIN");

    const codigoVerificacion = crypto.randomUUID().slice(0, 8);

    const docResult = await db.query(
      `INSERT INTO documentos (
         tipo, titulo, estado, hash_pdf, codigo_verificacion, 
         categoria_firma, creado_por, created_at, updated_at
       )
       VALUES ($1, $2, 'BORRADOR', NULL, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [tipo, titulo, codigoVerificacion, categoriaFirma, req.user.id]
    );

    const documento = docResult.rows[0];

    // Contexto de documento recién creado
    Sentry.setContext("document", {
      id: documento.id,
      title: documento.titulo,
      status: documento.estado,
      owner_id: documento.creado_por,
      verification_code: documento.codigo_verificacion,
    });

    for (const [index, f] of firmantes.entries()) {
      await db.query(
        `INSERT INTO firmantes (
           documento_id, nombre, email, rut, rol, orden_firma, 
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
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
      `INSERT INTO eventos_firma (
         documento_id, tipo_evento, metadata, created_at
       )
       VALUES ($1, 'CREADO', $2, NOW())`,
      [documento.id, JSON.stringify({ fuente: "API", creado_por: req.user.id })]
    );

    await db.query("COMMIT");

    return res.status(201).json({
      documentoId: documento.id,
      codigoVerificacion,
      message: "Flujo de documento creado exitosamente",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error creando flujo de documento:", error);
    return res.status(500).json({ error: "Error creando flujo de documento" });
  }
});

router.post("/firmar-flujo/:firmanteId", async (req, res) => {
  const { firmanteId } = req.params;

  try {
    const firmanteRes = await db.query(
      `SELECT f.*, d.id AS documento_id, d.estado AS documento_estado, d.titulo
       FROM firmantes f
       JOIN documentos d ON d.id = f.documento_id
       WHERE f.id = $1`,
      [firmanteId]
    );

    if (firmanteRes.rowCount === 0) {
      return res.status(404).json({ error: "Firmante no encontrado" });
    }

    const firmante = firmanteRes.rows[0];

    // Contexto de documento/firmante para errores aquí
    Sentry.setContext("document", {
      id: firmante.documento_id,
      title: firmante.titulo,
      status: firmante.documento_estado,
    });
    Sentry.setContext("firmante", {
      id: firmante.id,
      nombre: firmante.nombre,
      email: firmante.email,
      estado: firmante.estado,
      orden_firma: firmante.orden_firma,
    });

    if (firmante.estado === "FIRMADO") {
      return res.status(400).json({ error: "Este firmante ya firmó" });
    }

    if (firmante.estado === "RECHAZADO") {
      return res.status(400).json({ error: "Este firmante rechazó el documento" });
    }

    await db.query("BEGIN");

    await db.query(
      `UPDATE firmantes
       SET estado = 'FIRMADO',
           fecha_firma = NOW(),
           tipo_firma = 'SIMPLE',
           updated_at = NOW()
       WHERE id = $1`,
      [firmanteId]
    );

    await db.query(
      `INSERT INTO eventos_firma (
         documento_id, firmante_id, tipo_evento, ip, user_agent, metadata, created_at
       )
       VALUES ($1, $2, 'FIRMADO', $3, $4, $5, NOW())`,
      [
        firmante.documento_id,
        firmanteId,
        req.ip || null,
        req.headers["user-agent"] || null,
        JSON.stringify({ fuente: "API", via: "firmar-flujo" }),
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
        `INSERT INTO eventos_firma (
           documento_id, tipo_evento, metadata, created_at
         )
         VALUES ($1, 'DOCUMENTO_FIRMADO_COMPLETO', $2, NOW())`,
        [
          firmante.documento_id,
          JSON.stringify({
            descripcion: "Todos los firmantes han firmado",
            firmados: Number(firmados),
            total: Number(total),
          }),
        ]
      );
    }

    await db.query("COMMIT");

    return res.json({
      mensaje: allSigned
        ? "Firma registrada y documento completado"
        : "Firma registrada. Faltan firmantes",
      documentoId: firmante.documento_id,
      allSigned,
      progress: ((Number(firmados) / Number(total)) * 100).toFixed(1) + "%",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error firmando flujo de documento:", error);
    return res.status(500).json({ error: "Error firmando flujo de documento" });
  }
});

/* ================================
   RUTAS GET - CON PARÁMETROS (:id/...)
   ================================ */

// En estos endpoints ya tienes ownership en algunos;
// el contexto de documento se setea en checkDocumentOwnership
router.get("/:id/pdf", documentsController.getDocumentPdf);
router.get("/:id/timeline", documentsController.getTimeline);
router.get("/:id/signers", requireAuth, documentsController.getSigners);
router.get("/:id/download", documentsController.downloadDocument);
router.get(
  "/:id/reporte",
  requireAuth,
  checkDocumentOwnership,
  documentsController.downloadReportPdf
);

/* ================================
   RUTAS POST - CON PARÁMETROS (:id/...)
   ================================ */

router.post(
  "/:id/firmar",
  requireAuth,
  checkDocumentOwnership,
  logAuditAction,
  documentsController.signDocument
);
router.post(
  "/:id/visar",
  requireAuth,
  checkDocumentOwnership,
  logAuditAction,
  documentsController.visarDocument
);
router.post(
  "/:id/rechazar",
  requireAuth,
  checkDocumentOwnership,
  logAuditAction,
  documentsController.rejectDocument
);
router.post(
  "/:id/reenviar",
  requireAuth,
  checkDocumentOwnership,
  documentsController.resendReminder
);

router.post("/:id/recordatorio", requireAuth, checkDocumentOwnership, async (req, res) => {
  try {
    const { id } = req.params;

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
