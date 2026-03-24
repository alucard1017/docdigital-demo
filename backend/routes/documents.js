// backend/routes/documents.js
const express = require("express");
const Sentry = require("@sentry/node");

const { requireAuth } = require("./auth");
const db = require("../db");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const { validatePdf } = require("../middlewares/pdfValidator");

const documentsController = require("../controllers/documents");
const {
  resendReminder,
} = require("../controllers/documents/reminders");
const {
  downloadDocument,
  downloadReportPdf,
  getDocumentAnalytics,
  previewDocument,
} = require("../controllers/documents/report");
const {
  getReminderStatus,
  retryReminder,
} = require("../controllers/documents/remindersAdmin");

const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../utils/auditLog");
const {
  createRedisRateLimitMiddleware,
} = require("../utils/rateLimiter");
const remindersQueue = require("../queues/remindersQueue");

const router = express.Router();

/* ================================
   HELPERS DE PERMISOS / MULTI-TENANT
   ================================ */

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

async function loadDocumentById(id) {
  const docRes = await db.query(
    `SELECT id, owner_id, title, status, company_id
     FROM documents
     WHERE id = $1`,
    [id]
  );
  return docRes.rowCount > 0 ? docRes.rows[0] : null;
}

function setSentryDocumentContext(doc) {
  if (!doc) return;
  Sentry.setContext("document", {
    id: doc.id,
    owner_id: doc.owner_id,
    title: doc.title || undefined,
    status: doc.status || undefined,
    company_id: doc.company_id,
  });
}

async function checkDocumentCompanyScope(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const doc = await loadDocumentById(id);
    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    if (!isGlobalAdmin(user)) {
      if (!user.company_id || doc.company_id !== user.company_id) {
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }
    }

    setSentryDocumentContext(doc);
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

    const doc = await loadDocumentById(id);
    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

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

    setSentryDocumentContext(doc);
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
  validatePdf,
  withDocumentAudit("DOCUMENT_CREATED"),
  documentsController.createDocument
);

router.post(
  "/recordatorios-automaticos",
  requireAuth,
  createRedisRateLimitMiddleware({
    keyPrefix: "reminders",
    maxAttempts: 3,
    windowSeconds: 3600,
    errorMessage:
      "Demasiados intentos. Espera 1 hora antes de volver a enviar recordatorios.",
  }),
  async (req, res) => {
    try {
      await remindersQueue.add("auto-reminders", {
        userId: req.user.id,
      });

      return res.json({
        message:
          "Job de recordatorios automáticos encolado. Se procesará en segundo plano.",
      });
    } catch (err) {
      console.error("❌ Error encolando recordatorios automáticos:", err);
      return res.status(500).json({
        message: "Error encolando recordatorios automáticos",
      });
    }
  }
);

/* ================================
   RUTAS DE FLUJO (createFlow/sendFlow/signFlow)
   ================================ */

router.post(
  "/crear-flujo",
  requireAuth,
  withDocumentAudit("DOCUMENT_FLOW_CREATED"),
  documentsController.createFlow
);

router.post(
  "/enviar-flujo/:id",
  requireAuth,
  checkDocumentCompanyScope,
  withDocumentAudit("DOCUMENT_FLOW_SENT"),
  documentsController.sendFlow
);

// Firma pública legado (por firmanteId). Nuevo flujo público usa /api/public/docs/:token/firmar
router.post("/firmar-flujo/:firmanteId", documentsController.signFlow);

/* ================================
   RUTAS GET - CON :id
   ================================ */

router.get("/:id/pdf", documentsController.getDocumentPdf);
router.get("/:id/timeline", documentsController.getTimeline);

// NUEVO: timeline legal (document_events)
router.get(
  "/:id/timeline-legal",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.getLegalTimeline
);

router.get(
  "/:id/signers",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.getSigners
);

/* ================================
   RUTAS POST - ACCIONES SOBRE :id
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

/* ================================
   RUTAS POST - RECORDATORIOS
   ================================ */

router.post(
  "/:id/reenviar",
  requireAuth,
  checkDocumentCompanyScope,
  resendReminder
);

router.post(
  "/:id/recordatorio",
  requireAuth,
  checkDocumentCompanyScope,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        enviarRecordatorioManual,
      } = require("../services/reminderService");
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

/* ================================
   RUTAS ADMIN - RECORDATORIOS
   ================================ */

router.get("/recordatorios/status", requireAuth, getReminderStatus);

router.post(
  "/recordatorios/reintentar/:recordatorioId",
  requireAuth,
  retryReminder
);

module.exports = router;
