// backend/routes/documents.js
const express = require("express");
const crypto = require("crypto");
const Sentry = require("@sentry/node");
const { requireAuth } = require("./auth");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const documentsController = require("../controllers/documents");
const {
  resendReminder,
  sendAutomaticReminders,
} = require("../controllers/documents/reminders");
const {
  downloadDocument,
  downloadReportPdf,
  getDocumentAnalytics,
  previewDocument,
} = require("../controllers/documents/report");
const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../utils/auditLog");
const db = require("../db");

const router = express.Router();

/* ================================
   RATE LIMITING SIMPLE EN MEMORIA
   ================================ */

const rateLimitStore = {};

function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const current = rateLimitStore[key];

  if (!current) {
    rateLimitStore[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }

  if (now > current.resetAt) {
    rateLimitStore[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }

  if (current.count >= maxAttempts) {
    return false;
  }

  current.count += 1;
  return true;
}

/* ================================
   HELPERS DE PERMISOS / MULTI-TENANT
   ================================ */

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

async function checkDocumentCompanyScope(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `SELECT id, owner_id, title, status, company_id
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    if (!isGlobalAdmin(user)) {
      if (!user.company_id || doc.company_id !== user.company_id) {
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }
    }

    Sentry.setContext("document", {
      id: doc.id,
      owner_id: doc.owner_id,
      title: doc.title || undefined,
      status: doc.status || undefined,
      company_id: doc.company_id,
    });

    req.document = doc;
    return next();
  } catch (err) {
    console.error("❌ Error verificando permisos de documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function checkDocumentOwnership(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `SELECT id, owner_id, title, status, company_id
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    if (!isGlobalAdmin(user)) {
      if (!user.company_id || doc.company_id !== user.company_id) {
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }

      if (doc.owner_id !== user.id) {
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }
    }

    Sentry.setContext("document", {
      id: doc.id,
      owner_id: doc.owner_id,
      title: doc.title || undefined,
      status: doc.status || undefined,
      company_id: doc.company_id,
    });

    req.document = doc;
    return next();
  } catch (err) {
    console.error("❌ Error verificando propiedad de documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   HOOK DE AUDITORÍA (logAudit)
   ================================ */

function withDocumentAudit(action) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (res.statusCode < 400) {
        const rawId =
          req.params.id ||
          req.params.documento_id ||
          (body && (body.documentoId || body.id)) ||
          null;

        const entityId = rawId ? Number(rawId) : null;

        const metadata = buildDocumentAuditMetadata({
          documentId: entityId,
          title: req.document?.title,
          status: req.document?.status,
          companyId: req.document?.company_id || req.user?.company_id || null,
          extra: {
            path: req.originalUrl,
            method: req.method,
            response_status: res.statusCode,
          },
        });

        logAudit({
          user: req.user || null,
          action,
          entityType: "document",
          entityId,
          metadata,
          req,
        });
      }

      return originalJson(body);
    };

    return next();
  };
}

/* ================================
   RUTAS GET - ESPECÍFICAS (SIN ID)
   ================================ */

router.get("/stats", requireAuth, documentsController.getDocumentStats);

// Usamos la versión de analytics del controlador dedicado (report.js)
router.get("/analytics", requireAuth, getDocumentAnalytics);

router.get("/export/excel", requireAuth, async (req, res) => {
  try {
    const { generarExcelDocumentos } = require("../services/excelExport");

    const excelBuffer = await generarExcelDocumentos({
      userId: req.user.id,
      companyId: req.user.company_id,
      isGlobalAdmin: isGlobalAdmin(req.user),
    });

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
    console.error("❌ Error exportando Excel:", error);
    return res.status(500).json({ error: "Error exportando Excel" });
  }
});

/* ================================
   RUTAS GET - AUDITORÍA LEGACY
   ================================ */

router.get("/audit", requireAuth, async (req, res) => {
  try {
    const { documento_id, usuario_id, evento_tipo, limit = 100 } = req.query;

    const values = [];
    const where = [];

    if (documento_id) {
      const docIdNum = Number(documento_id);
      if (!Number.isNaN(docIdNum)) {
        values.push(docIdNum);
        where.push(`documento_id = $${values.length}`);
      }
    }

    if (usuario_id) {
      const userIdNum = Number(usuario_id);
      if (!Number.isNaN(userIdNum)) {
        values.push(userIdNum);
        where.push(`usuario_id = $${values.length}`);
      }
    }

    if (evento_tipo) {
      values.push(evento_tipo);
      where.push(`evento_tipo = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const safeLimit = Math.min(Number(limit) || 100, 1000);
    values.push(safeLimit);
    const limitIndex = values.length;

    const result = await db.query(
      `SELECT
         id,
         documento_id,
         usuario_id,
         evento_tipo,
         descripcion,
         ip_address,
         user_agent,
         created_at
       FROM auditoria_documentos
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIndex}`,
      values
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo auditoría:", err);
    return res.status(500).json({ message: "Error obteniendo auditoría" });
  }
});

/* ================================
   RUTAS GET - LISTADOS
   ================================ */

router.get("/", requireAuth, documentsController.getUserDocuments);

/* ================================
   RUTAS POST - SIN PARÁMETROS
   ================================ */

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  handleMulterError,
  withDocumentAudit("DOCUMENT_CREATED"),
  documentsController.createDocument
);

/**
 * Recordatorios automáticos (por usuario).
 * Ruta real: POST /api/documents/recordatorios-automaticos
 */
router.post(
  "/recordatorios-automaticos",
  requireAuth,
  (req, res, next) => {
    const key = `reminders_${req.user.id}`;
    if (!checkRateLimit(key, 3, 3600000)) {
      return res.status(429).json({
        message:
          "Demasiados intentos. Espera 1 hora antes de volver a enviar recordatorios.",
      });
    }
    return next();
  },
  sendAutomaticReminders
);

/* ================================
   RUTAS DE FLUJO
   ================================ */

router.post("/crear-flujo", requireAuth, documentsController.createFlow);

router.post("/enviar-flujo/:id", requireAuth, documentsController.sendFlow);

router.post("/firmar-flujo/:firmanteId", documentsController.signFlow);

/* ================================
   RUTAS GET - CON :id
   ================================ */

router.get("/:id/pdf", documentsController.getDocumentPdf);

router.get("/:id/timeline", documentsController.getTimeline);

router.get(
  "/:id/signers",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.getSigners
);

/**
 * Vista previa del PDF original del documento.
 * Ruta real: GET /api/documents/:id/preview
 */
router.get("/:id/preview", previewDocument);

/**
 * Descargar PDF original del documento.
 * Ruta real: GET /api/documents/:id/download
 */
router.get("/:id/download", downloadDocument);

/**
 * Descargar reporte PDF con detalles.
 * Ruta real: GET /api/documents/:id/reporte
 */
router.get(
  "/:id/reporte",
  requireAuth,
  checkDocumentCompanyScope,
  downloadReportPdf
);

/* ================================
   RUTAS POST - CON :id
   ================================ */

router.post(
  "/:id/firmar",
  requireAuth,
  checkDocumentCompanyScope,
  withDocumentAudit("DOCUMENT_SIGNED"),
  documentsController.signDocument
);

router.post(
  "/:id/visar",
  requireAuth,
  checkDocumentCompanyScope,
  withDocumentAudit("DOCUMENT_VISADO"),
  documentsController.visarDocument
);

router.post(
  "/:id/rechazar",
  requireAuth,
  checkDocumentCompanyScope,
  withDocumentAudit("DOCUMENT_REJECTED"),
  documentsController.rejectDocument
);

/**
 * Reenviar recordatorio (visado o firma).
 * Ruta real: POST /api/documents/:id/reenviar
 */
router.post(
  "/:id/reenviar",
  requireAuth,
  checkDocumentCompanyScope,
  resendReminder
);

/**
 * Recordatorio manual “a todos” para un documento concreto.
 * Ruta real: POST /api/documents/:id/recordatorio
 */
router.post(
  "/:id/recordatorio",
  requireAuth,
  checkDocumentCompanyScope,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const { enviarRecordatorioManual } =
        require("../services/reminderService");
      const result = await enviarRecordatorioManual(id);

      const metadata = buildDocumentAuditMetadata({
        documentId: id,
        title: req.document?.title,
        status: req.document?.status,
        companyId: req.document?.company_id || req.user?.company_id || null,
        extra: {
          path: req.originalUrl,
          method: req.method,
        },
      });

      logAudit({
        user: req.user,
        action: "DOCUMENT_REMINDER_MANUAL",
        entityType: "document",
        entityId: id,
        metadata,
        req,
      });

      return res.json(result);
    } catch (err) {
      console.error("❌ Error enviando recordatorio:", err);
      return res.status(500).json({
        message: err.message || "Error enviando recordatorio",
      });
    }
  }
);

module.exports = router;
