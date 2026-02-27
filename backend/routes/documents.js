// backend/routes/documents.js
const express = require("express");
const crypto = require("crypto");
const Sentry = require("@sentry/node");
const { requireAuth } = require("./auth");
const { upload, handleMulterError } = require("../middlewares/uploadPdf");
const documentsController = require("../controllers/documents");
const db = require("../db");

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

  rateLimit[key].count += 1;
  return true;
}

/* ================================
   HELPERS DE PERMISOS / MULTI-TENANT
   ================================ */

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

/**
 * Middleware que asegura que el documento:
 * - Existe
 * - Pertenece a la misma company_id del usuario (salvo admins globales)
 */
async function checkDocumentCompanyScope(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

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

/**
 * Middleware de propiedad (exigir que sea dueño, además de misma empresa)
 */
async function checkDocumentOwnership(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

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
   MIDDLEWARE DE AUDITORÍA (SIMPLIFICADO)
   ================================ */

function logAuditAction(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function patchedJson(data) {
    if (res.statusCode < 400) {
      const { registrarAuditoria } = require("../utils/auditLog");

      registrarAuditoria({
        documento_id: req.params.id || null,
        usuario_id: req.user?.id || null,
        evento_tipo: "API_ACTION",
        descripcion: `${req.method} ${req.route?.path}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"] || null,
      }).catch((err) => console.error("⚠️ Error logging audit:", err));
    }

    return originalJson(data);
  };

  return next();
}

/* ================================
   RUTAS GET - ESPECÍFICAS (SIN PARÁMETROS)
   ================================ */

// Stats de documentos (multi-tenant)
router.get(
  "/stats",
  requireAuth,
  documentsController.getDocumentStats
);

// Analytics generales (el controller debe respetar company_id)
router.get(
  "/analytics",
  requireAuth,
  documentsController.getDocumentAnalytics
);

// Exportar a Excel: limitar por empresa salvo admins globales
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

// Auditoría de documentos (podrías filtrar por company_id en el SQL)
router.get("/audit", requireAuth, async (req, res) => {
  try {
    const { documento_id, usuario_id, evento_tipo, limit = 100 } = req.query;

    const values = [];
    const where = [];

    if (documento_id) {
      values.push(Number(documento_id));
      where.push(`documento_id = $${values.length}`);
    }
    if (usuario_id) {
      values.push(Number(usuario_id));
      where.push(`usuario_id = $${values.length}`);
    }
    if (evento_tipo) {
      values.push(evento_tipo);
      where.push(`evento_tipo = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    values.push(Number(limit));
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
   RUTAS GET - LISTADOS (SIN PARÁMETROS)
   ================================ */

// Lista de documentos (controller filtra por company_id salvo globales)
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
    if (!checkRateLimit(key, 3, 3600000)) {
      return res.status(429).json({
        message:
          "Demasiados intentos. Espera 1 hora antes de volver a enviar recordatorios.",
      });
    }
    return next();
  },
  documentsController.sendAutomaticReminders
);

/* ================================
   RUTAS DE FLUJO (NUEVA TABLA documentos / firmantes)
   ================================ */

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
         tipo,
         titulo,
         estado,
         hash_pdf,
         codigo_verificacion,
         categoria_firma,
         creado_por,
         company_id,
         created_at,
         updated_at
       )
       VALUES ($1, $2, 'BORRADOR', NULL, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        tipo,
        titulo,
        codigoVerificacion,
        categoriaFirma,
        req.user.id,
        req.user.company_id,
      ]
    );

    const documento = docResult.rows[0];

    Sentry.setContext("document", {
      id: documento.id,
      title: documento.titulo,
      status: documento.estado,
      owner_id: documento.creado_por,
      verification_code: documento.codigo_verificacion,
      company_id: documento.company_id,
    });

    for (const [index, f] of firmantes.entries()) {
      await db.query(
        `INSERT INTO firmantes (
           documento_id,
           nombre,
           email,
           rut,
           rol,
           orden_firma,
           created_at,
           updated_at
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
         documento_id,
         tipo_evento,
         metadata,
         created_at
       )
       VALUES ($1, 'CREADO', $2, NOW())`,
      [
        documento.id,
        JSON.stringify({ fuente: "API", creado_por: req.user.id }),
      ]
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
      `SELECT
         f.*,
         d.id     AS documento_id,
         d.estado AS documento_estado,
         d.titulo
       FROM firmantes f
       JOIN documentos d ON d.id = f.documento_id
       WHERE f.id = $1`,
      [firmanteId]
    );

    if (firmanteRes.rowCount === 0) {
      return res.status(404).json({ error: "Firmante no encontrado" });
    }

    const firmante = firmanteRes.rows[0];

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
      return res
        .status(400)
        .json({ error: "Este firmante rechazó el documento" });
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
         documento_id,
         firmante_id,
         tipo_evento,
         ip,
         user_agent,
         metadata,
         created_at
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
    const firmadosNum = Number(firmados);
    const totalNum = Number(total);
    const allSigned = firmadosNum >= totalNum;

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
           documento_id,
           tipo_evento,
           metadata,
           created_at
         )
         VALUES ($1, 'DOCUMENTO_FIRMADO_COMPLETO', $2, NOW())`,
        [
          firmante.documento_id,
          JSON.stringify({
            descripcion: "Todos los firmantes han firmado",
            firmados: firmadosNum,
            total: totalNum,
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
      progress: ((firmadosNum / totalNum) * 100).toFixed(1) + "%",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error firmando flujo de documento:", error);
    return res
      .status(500)
      .json({ error: "Error firmando flujo de documento" });
  }
});

/* ================================
   RUTAS GET - CON PARÁMETROS (:id/...)
   ================================ */

router.get("/:id/pdf", documentsController.getDocumentPdf);
router.get("/:id/timeline", documentsController.getTimeline);
router.get(
  "/:id/signers",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.getSigners
);
router.get("/:id/download", documentsController.downloadDocument);
router.get(
  "/:id/reporte",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.downloadReportPdf
);

/* ================================
   RUTAS POST - CON PARÁMETROS (:id/...)
   ================================ */

router.post(
  "/:id/firmar",
  requireAuth,
  checkDocumentCompanyScope,
  logAuditAction,
  documentsController.signDocument
);

router.post(
  "/:id/visar",
  requireAuth,
  checkDocumentCompanyScope,
  logAuditAction,
  documentsController.visarDocument
);

router.post(
  "/:id/rechazar",
  requireAuth,
  checkDocumentCompanyScope,
  logAuditAction,
  documentsController.rejectDocument
);

router.post(
  "/:id/reenviar",
  requireAuth,
  checkDocumentCompanyScope,
  documentsController.resendReminder
);

router.post(
  "/:id/recordatorio",
  requireAuth,
  checkDocumentCompanyScope,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enviarRecordatorioManual } =
        require("../services/reminderService");

      const result = await enviarRecordatorioManual(id);
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
   EXPORTAR ROUTER
   ================================ */

module.exports = router;
