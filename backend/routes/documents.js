// backend/routes/documents.js
const express = require("express");
const Sentry = require("@sentry/node");

const { requireAuth } = require("./auth");
const db = require("../db");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const { validatePdf } = require("../middlewares/pdfValidator");

const documentsController = require("../controllers/documents");
const { resendReminder } = require("../controllers/documents/reminders");
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

// NUEVO: helpers para flujo multi–party sobre "documentos"
const { validateCreateDocumentBody } = require("../validators/createDocumentSchema");
const { generateVerificationCode } = require("../utils/randomCode");
const emailQueue = require("../queues/emailQueue");

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
   RUTAS POST - LEGACY (UPLOAD FILE)
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

/* ================================
   NUEVO: RUTA POST /documents (JSON multi-party, tabla `documentos`)
   ================================ */

router.post(
  "/multi-party",
  requireAuth,
  async (req, res) => {
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
        null, // hash_pdf
        flowType,
      ];

      const docResult = await client.query(insertDocText, docValues);
      const documento = docResult.rows[0];

      // Insert signers uno a uno para evitar SQL dinámico complejo
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

      // Audit log
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
      return res
        .status(500)
        .json({ message: "Error interno creando documento multi-party" });
    } finally {
      client.release();
    }
  }
);

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
/* ================================
   NUEVO: INVITAR A UN SIGNER (multi-party)
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

      // 1) Cargar documento multi-party desde `documentos`
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

      // Enforzar scope multi-tenant básico
      if (!isGlobalAdmin(user) && documento.company_id !== user.company_id) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ message: "No tienes permisos sobre este documento" });
      }

      // 2) Cargar signer
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

      // 3) Crear o renovar invitation
      // Para simplificar: siempre creamos una invitation nueva (puedes luego invalidar las anteriores si quieres)
      const token = require("crypto").randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

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
        [signer.id, token, expiresAt.toISOString()]
      );
      const invitation = inviteRes.rows[0];

      // 4) Actualizar estado del signer
      await client.query(
        `
        UPDATE public.signers
        SET status = 'invited', updated_at = now()
        WHERE id = $1
        `,
        [signer.id]
      );

      // 5) Registrar en audit_logs
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

      // 6) Encolar envío de correo (opcional, si tienes cola)
      try {
        if (emailQueue && typeof emailQueue.add === "function") {
          await emailQueue.add("send-signer-invite", {
            signerEmail: signer.email,
            signerName: signer.full_name,
            documentoTitulo: documento.titulo,
            // URL pública de firma (ajusta el dominio y ruta pública)
            signingUrl: `${process.env.APP_PUBLIC_URL}/public/docs/${invitation.token}`,
          });
        }
      } catch (mailErr) {
        // No rompemos la respuesta si falla la cola; ya quedó en DB
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
      return res
        .status(500)
        .json({ message: "Error interno enviando invitación" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;