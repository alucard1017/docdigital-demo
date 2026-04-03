// backend/routes/documents.js
const express = require("express");
const Sentry = require("@sentry/node");

const { requireAuth } = require("./auth");
const db = require("../db");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const { validatePdf } = require("../middlewares/pdfValidator");

const documentsController = require("../controllers/documents");
const {
  downloadDocument,
  downloadReportPdf,
  getDocumentAnalytics,
  previewDocument,
} = require("../controllers/documents/report");

const { resendReminder } = require("../controllers/documents/reminders");
const {
  getReminderStatus,
  retryReminder,
} = require("../controllers/documents/remindersAdmin");

const { logAudit, buildDocumentAuditMetadata } = require("../utils/auditLog");
const { createRedisRateLimitMiddleware } = require("../utils/rateLimiter");
const remindersQueue = require("../queues/remindersQueue");
const { validateCreateDocumentBody } = require("../validators/createDocumentSchema");
const { generateVerificationCode } = require("../utils/randomCode");
const emailQueue = require("../queues/emailQueue");
const {
  getReminderSchedulerStatus,
  ejecutarRecordatorios,
} = require("../jobs/reminderScheduler");

const router = express.Router();

/* ================================
   HELPERS DE PERMISOS / MULTI‑TENANT
   ================================ */

const isGlobalAdmin = (user) =>
  user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";

async function loadDocumentById(id) {
  const docRes = await db.query(
    `
    SELECT id, owner_id, title, status, company_id
    FROM documents
    WHERE id = $1
    `,
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

async function checkLegacyDocumentCompanyScope(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `
      SELECT id, creado_por, titulo, estado, company_id
      FROM documentos
      WHERE id = $1
      `,
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

    req.documentLegacy = doc;
    return next();
  } catch (err) {
    console.error("❌ Error verificando permisos de documento legacy:", err);
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
   HOOK DE AUDITORÍA
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

if (typeof documentsController.getDocumentStats === "function") {
  router.get("/stats", requireAuth, documentsController.getDocumentStats);
} else {
  console.warn(
    "[routes/documents] getDocumentStats no es función; ruta /stats deshabilitada"
  );
}

if (typeof getDocumentAnalytics === "function") {
  router.get("/analytics", requireAuth, getDocumentAnalytics);
} else {
  console.warn(
    "[routes/documents] getDocumentAnalytics no es función; ruta /analytics deshabilitada"
  );
}

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
      `
      SELECT
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
      LIMIT $${limitIndex}
      `,
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
   RUTAS POST - LEGACY (UPLOAD FILE)
   ================================ */

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  handleMulterError,
  validatePdf,
  withDocumentAudit("DOCUMENT_CREATED"),
  async (req, res, next) => {
    try {
      return await documentsController.createDocument(req, res, next);
    } catch (err) {
      console.error("❌ Error en createDocument:", err);
      if (!res.headersSent) {
        return res.status(500).json({
          message: "Error interno creando documento",
        });
      }
    }
  }
);

/* ================================
   RUTA POST /documents/multi-party (JSON multi‑party)
   ================================ */

router.post("/multi-party", requireAuth, async (req, res) => {
  const user = req.user;

  if (!user || !user.id || !user.company_id) {
    return res.status(401).json({ message: "No autenticado o sin company_id" });
  }

  const errors = validateCreateDocumentBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Body inválido", errors });
  }

  const {
    title,
    description,
    fileUrl,
    flowType = "simple_signature",
    category = "simple",
    expiresAt,
    signers,
  } = req.body;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const codigoVerificacion = generateVerificationCode();

    const insertDocText = `
      INSERT INTO public.documentos (
        titulo,
        tipo,
        estado,
        categoria_firma,
        codigo_verificacion,
        creado_por,
        company_id,
        created_at,
        updated_at,
        fecha_expiracion,
        hash_pdf,
        tipo_flujo
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, now(), now(),
        $8, $9, $10
      )
      RETURNING id, codigo_verificacion, estado, tipo_flujo, categoria_firma;
    `;

    const docValues = [
      title,
      "documento",
      "BORRADOR",
      category,
      codigoVerificacion,
      user.id,
      user.company_id,
      expiresAt || null,
      null,
      flowType,
    ];

    const docResult = await client.query(insertDocText, docValues);
    const documento = docResult.rows[0];

    const signerInsertSql = `
      INSERT INTO public.signers (
        documento_id,
        company_id,
        role,
        full_name,
        email,
        phone,
        identifier,
        order_index,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,'pending', now(), now()
      )
      RETURNING id, role, full_name, email, status;
    `;

    const createdSigners = [];

    for (const s of signers) {
      const signerRes = await client.query(signerInsertSql, [
        documento.id,
        user.company_id,
        s.role,
        s.fullName,
        s.email,
        s.phone || null,
        s.identifier || null,
        typeof s.orderIndex === "number" ? s.orderIndex : 1,
      ]);
      createdSigners.push(signerRes.rows[0]);
    }

    const ip =
      (req.headers["x-forwarded-for"] || "")
        .toString()
        .split(",")[0]
        .trim() || req.socket.remoteAddress || null;

    const userAgent = req.headers["user-agent"] || null;

    const auditText = `
      INSERT INTO public.audit_logs (
        documento_id,
        signer_id,
        event_type,
        event_at,
        ip_address,
        user_agent,
        documento_estado,
        metadata,
        created_at
      ) VALUES (
        $1, NULL, 'document_created', now(), $2, $3, $4, $5, now()
      );
    `;

    const auditMetadata = {
      createdByUserId: user.id,
      companyId: user.company_id,
      title,
      flowType,
      category,
      fileUrl,
      description,
    };

    await client.query(auditText, [
      documento.id,
      ip,
      userAgent,
      documento.estado,
      auditMetadata,
    ]);

    await client.query("COMMIT");

    return res.status(201).json({
      id: documento.id,
      codigoVerificacion: documento.codigo_verificacion,
      estado: documento.estado,
      tipoFlujo: documento.tipo_flujo,
      categoriaFirma: documento.categoria_firma,
      signers: createdSigners.map((s) => ({
        id: s.id,
        role: s.role,
        fullName: s.full_name,
        email: s.email,
        status: s.status,
      })),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creando documento multi-party:", err);
    return res.status(500).json({
      message: "Error interno creando documento multi-party",
    });
  } finally {
    client.release();
  }
});

/* ================================
   RUTAS POST - SIN PARÁMETROS
   ================================ */

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
   RUTAS DE FLUJO
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
  checkLegacyDocumentCompanyScope,
  withDocumentAudit("DOCUMENT_FLOW_SENT"),
  documentsController.sendFlow
);

// Firma pública legacy (por firmanteId)
router.post("/firmar-flujo/:firmanteId", documentsController.signFlow);

/* ================================
   RUTAS GET - CON :id
   ================================ */

if (typeof documentsController.getDocumentPdf === "function") {
  router.get("/:id/pdf", documentsController.getDocumentPdf);
} else {
  console.warn(
    "[routes/documents] getDocumentPdf no es función; ruta /:id/pdf deshabilitada"
  );
}

if (typeof previewDocument === "function") {
  router.get("/:id/preview", previewDocument);
} else {
  console.warn(
    "[routes/documents] previewDocument no es función; ruta /:id/preview deshabilitada"
  );
}

if (typeof downloadDocument === "function") {
  router.get("/:id/download", downloadDocument);
} else {
  console.warn(
    "[routes/documents] downloadDocument no es función; ruta /:id/download deshabilitada"
  );
}

if (typeof documentsController.getTimeline === "function") {
  router.get("/:id/timeline", documentsController.getTimeline);
} else {
  console.warn(
    "[routes/documents] getTimeline no es función; ruta /:id/timeline deshabilitada"
  );
}

if (typeof documentsController.getLegalTimeline === "function") {
  router.get(
    "/:id/timeline-legal",
    requireAuth,
    checkDocumentCompanyScope,
    documentsController.getLegalTimeline
  );
} else {
  console.warn(
    "[routes/documents] getLegalTimeline no es función; ruta /:id/timeline-legal deshabilitada"
  );
}

if (typeof documentsController.getSigners === "function") {
  router.get(
    "/:id/signers",
    requireAuth,
    checkDocumentCompanyScope,
    documentsController.getSigners
  );
} else {
  console.warn(
    "[routes/documents] getSigners no es función; ruta /:id/signers deshabilitada"
  );
}

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

      const { enviarRecordatorioManual } = require("../services/reminderService");

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

router.get(
  "/recordatorios/scheduler-status",
  requireAuth,
  async (req, res) => {
    try {
      const status = getReminderSchedulerStatus();
      return res.json({ ok: true, scheduler: status });
    } catch (err) {
      console.error(
        "❌ Error obteniendo estado del reminder scheduler:",
        err
      );
      return res.status(500).json({
        ok: false,
        message: "Error obteniendo estado del scheduler",
      });
    }
  }
);

router.post(
  "/recordatorios/scheduler-ejecutar",
  requireAuth,
  async (req, res) => {
    try {
      const result = await ejecutarRecordatorios({ source: "manual_api" });

      return res.json({ ok: true, result });
    } catch (err) {
      console.error(
        "❌ Error ejecutando reminder scheduler manualmente:",
        err
      );
      return res.status(500).json({
        ok: false,
        message: "Error ejecutando el scheduler manualmente",
      });
    }
  }
);

/* ================================
   NUEVO: INVITAR A UN SIGNER (multi‑party)
   ================================ */

router.post(
  "/:documentoId/signers/:signerId/invite",
  requireAuth,
  async (req, res) => {
    const user = req.user;
    const documentoId = Number(req.params.documentoId);
    const signerId = Number(req.params.signerId);

    if (!user || !user.company_id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (Number.isNaN(documentoId) || Number.isNaN(signerId)) {
      return res.status(400).json({ message: "IDs inválidos" });
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const docRes = await client.query(
        `
        SELECT id, company_id, titulo, estado, tipo_flujo
        FROM public.documentos
        WHERE id = $1
        `,
        [documentoId]
      );

      if (docRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Documento no encontrado" });
      }

      const documento = docRes.rows[0];

      if (!isGlobalAdmin(user) && documento.company_id !== user.company_id) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }

      const signerRes = await client.query(
        `
        SELECT
          id,
          documento_id,
          company_id,
          full_name,
          email,
          role,
          status
        FROM public.signers
        WHERE id = $1 AND documento_id = $2
        `,
        [signerId, documentoId]
      );

      if (signerRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Signer no encontrado" });
      }

      const signer = signerRes.rows[0];

      if (signer.company_id && signer.company_id !== user.company_id) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este firmante" });
      }

      const token = require("crypto").randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const inviteRes = await client.query(
        `
        INSERT INTO public.signer_invitations (
          signer_id,
          token,
          expires_at,
          sent_at,
          created_at
        ) VALUES (
          $1, $2, $3, now(), now()
        )
        RETURNING id, token, expires_at, sent_at;
        `,
        [signer.id, expiresAt.toISOString(), token]
      );

      const invitation = inviteRes.rows[0];

      await client.query(
        `
        UPDATE public.signers
        SET status = 'invited', updated_at = now()
        WHERE id = $1
        `,
        [signer.id]
      );

      const ip =
        (req.headers["x-forwarded-for"] || "")
          .toString()
          .split(",")[0]
          .trim() || req.socket.remoteAddress || null;

      const userAgent = req.headers["user-agent"] || null;

      const auditText = `
        INSERT INTO public.audit_logs (
          documento_id,
          signer_id,
          event_type,
          event_at,
          ip_address,
          user_agent,
          documento_estado,
          signer_status,
          metadata,
          created_at
        ) VALUES (
          $1, $2, 'invite_sent', now(), $3, $4, $5, $6, $7, now()
        );
      `;

      const metadata = {
        invitedByUserId: user.id,
        invitedByEmail: user.email || null,
        signer: {
          id: signer.id,
          fullName: signer.full_name,
          email: signer.email,
          role: signer.role,
        },
        invitationId: invitation.id,
      };

      await client.query(auditText, [
        documento.id,
        signer.id,
        ip,
        userAgent,
        documento.estado,
        "invited",
        metadata,
      ]);

      await client.query("COMMIT");

      try {
        if (emailQueue && typeof emailQueue.add === "function") {
          await emailQueue.add("send-signer-invite", {
            signerEmail: signer.email,
            signerName: signer.full_name,
            documentoTitulo: documento.titulo,
            signingUrl: `${process.env.APP_PUBLIC_URL}/public/docs/${invitation.token}`,
          });
        }
      } catch (mailErr) {
        console.error("⚠️ Error encolando correo de invitación:", mailErr);
      }

      return res.status(201).json({
        message: "Invitación enviada",
        documentoId: documento.id,
        signerId: signer.id,
        invitation: {
          id: invitation.id,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          sentAt: invitation.sent_at,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Error invitando signer:", err);
      return res.status(500).json({
        message: "Error interno enviando invitación",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;