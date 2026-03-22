// backend/controllers/reminders/reminderConfigController.js
const { db } = require("../../db");
const { logAudit } = require("../../utils/auditLog");

/**
 * GET /api/reminders/config
 * Obtener configuración de recordatorios de la empresa del usuario
 */
async function getConfig(req, res) {
  try {
    const companyId = req.user.company_id;

    const result = await db.query(
      `SELECT * FROM reminder_config WHERE company_id = $1`,
      [companyId]
    );

    if (result.rowCount === 0) {
      // Crear configuración por defecto
      const defaultRes = await db.query(
        `INSERT INTO reminder_config (company_id, interval_days, max_attempts)
         VALUES ($1, 3, 3)
         RETURNING *`,
        [companyId]
      );
      return res.json(defaultRes.rows[0]);
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo configuración de recordatorios:", err);
    return res.status(500).json({
      message: "Error obteniendo configuración",
    });
  }
}

/**
 * PUT /api/reminders/config
 * Actualizar configuración de recordatorios (solo ADMIN)
 */
async function updateConfig(req, res) {
  try {
    const { interval_days, max_attempts, enabled } = req.body;
    const companyId = req.user.company_id;

    // Validaciones
    if (interval_days && (interval_days < 1 || interval_days > 30)) {
      return res.status(400).json({
        message: "interval_days debe estar entre 1 y 30 días",
      });
    }

    if (max_attempts && (max_attempts < 1 || max_attempts > 10)) {
      return res.status(400).json({
        message: "max_attempts debe estar entre 1 y 10",
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (interval_days !== undefined) {
      updates.push(`interval_days = $${paramIndex}`);
      params.push(interval_days);
      paramIndex++;
    }

    if (max_attempts !== undefined) {
      updates.push(`max_attempts = $${paramIndex}`);
      params.push(max_attempts);
      paramIndex++;
    }

    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex}`);
      params.push(enabled);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);
    params.push(companyId);

    if (updates.length === 1) {
      // Solo updated_at, sin cambios reales
      return res.status(400).json({
        message: "No hay campos para actualizar",
      });
    }

    const result = await db.query(
      `UPDATE reminder_config
       SET ${updates.join(", ")}
       WHERE company_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Configuración no encontrada",
      });
    }

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
    });
  }
}

module.exports = {
  getConfig,
  updateConfig,
};
