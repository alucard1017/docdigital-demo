// backend/controllers/reminders/reminderConfigController.js
const dbModule = require("../../db");
const { logAudit } = require("../../utils/auditLog");

const db = dbModule?.db || dbModule;

function ensureDb() {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "Conexión DB no disponible en reminderConfigController. Verifica ../../db"
    );
  }
}

function getCompanyId(req) {
  return (
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.user?.company?.id ||
    null
  );
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function parseOptionalBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/**
 * GET /api/reminders/config
 * Obtener configuración de recordatorios de la empresa del usuario
 */
async function getConfig(req, res) {
  try {
    ensureDb();

    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        message: "No se pudo determinar la empresa del usuario autenticado",
      });
    }

    const result = await db.query(
      `
      SELECT
        id,
        company_id,
        interval_days,
        max_attempts,
        COALESCE(enabled, true) AS enabled,
        created_at,
        updated_at
      FROM reminder_config
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (result.rowCount > 0) {
      return res.json(result.rows[0]);
    }

    const defaultRes = await db.query(
      `
      INSERT INTO reminder_config (
        company_id,
        interval_days,
        max_attempts,
        enabled,
        created_at,
        updated_at
      )
      VALUES ($1, 3, 3, true, NOW(), NOW())
      ON CONFLICT (company_id)
      DO UPDATE SET updated_at = NOW()
      RETURNING
        id,
        company_id,
        interval_days,
        max_attempts,
        COALESCE(enabled, true) AS enabled,
        created_at,
        updated_at
      `,
      [companyId]
    );

    return res.json(defaultRes.rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo configuración de recordatorios:", err);
    return res.status(500).json({
      message: "Error obteniendo configuración",
      detail:
        process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
}

/**
 * PUT /api/reminders/config
 * Actualizar configuración de recordatorios (solo ADMIN)
 */
async function updateConfig(req, res) {
  try {
    ensureDb();

    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        message: "No se pudo determinar la empresa del usuario autenticado",
      });
    }

    const intervalDays = parseOptionalInteger(req.body?.interval_days);
    const maxAttempts = parseOptionalInteger(req.body?.max_attempts);
    const enabled = parseOptionalBoolean(req.body?.enabled);

    if (Number.isNaN(intervalDays)) {
      return res.status(400).json({
        message: "interval_days debe ser un número entero",
      });
    }

    if (Number.isNaN(maxAttempts)) {
      return res.status(400).json({
        message: "max_attempts debe ser un número entero",
      });
    }

    if (intervalDays !== undefined && (intervalDays < 1 || intervalDays > 30)) {
      return res.status(400).json({
        message: "interval_days debe estar entre 1 y 30 días",
      });
    }

    if (maxAttempts !== undefined && (maxAttempts < 1 || maxAttempts > 10)) {
      return res.status(400).json({
        message: "max_attempts debe estar entre 1 y 10",
      });
    }

    if (
      intervalDays === undefined &&
      maxAttempts === undefined &&
      enabled === undefined
    ) {
      return res.status(400).json({
        message: "No hay campos válidos para actualizar",
      });
    }

    const result = await db.query(
      `
      INSERT INTO reminder_config (
        company_id,
        interval_days,
        max_attempts,
        enabled,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        COALESCE($2, 3),
        COALESCE($3, 3),
        COALESCE($4, true),
        NOW(),
        NOW()
      )
      ON CONFLICT (company_id)
      DO UPDATE SET
        interval_days = COALESCE($2, reminder_config.interval_days),
        max_attempts = COALESCE($3, reminder_config.max_attempts),
        enabled = COALESCE($4, reminder_config.enabled),
        updated_at = NOW()
      RETURNING
        id,
        company_id,
        interval_days,
        max_attempts,
        COALESCE(enabled, true) AS enabled,
        created_at,
        updated_at
      `,
      [companyId, intervalDays, maxAttempts, enabled]
    );

    const config = result.rows[0];

    await logAudit({
      user: req.user,
      action: "REMINDER_CONFIG_UPDATED",
      entityType: "reminder_config",
      entityId: config.id,
      metadata: {
        company_id: companyId,
        interval_days: config.interval_days,
        max_attempts: config.max_attempts,
        enabled: config.enabled,
      },
      req,
    });

    return res.json({
      message: "Configuración actualizada",
      config,
    });
  } catch (err) {
    console.error("❌ Error actualizando configuración:", err);
    return res.status(500).json({
      message: "Error actualizando configuración",
      detail:
        process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
}

module.exports = {
  getConfig,
  updateConfig,
};