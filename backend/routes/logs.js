// backend/routes/logs.js
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("./auth");

const router = express.Router();

/**
 * Normaliza parámetro de fecha/hora desde querystring.
 */
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * GET /api/logs/audit
 * Lista eventos de audit_log con filtros básicos.
 *
 * Solo SUPER_ADMIN y ADMIN_GLOBAL.
 *
 * Query params opcionales:
 * - action: filtra por acción exacta (DOCUMENT_SIGNED, USER_CREATED, etc.)
 * - entity_type: filtra por tipo de entidad (document, user, company, etc.)
 * - user_id: id de usuario actor
 * - company_id: id de empresa
 * - from: ISO date (incluyente)
 * - to: ISO date (incluyente)
 * - limit: máximo de filas (por defecto 100, máximo 1000)
 */
router.get(
  "/audit",
  requireAuth,
  requireRole("ADMIN_GLOBAL"), // SUPER_ADMIN también pasa
  async (req, res) => {
    try {
      const {
        action,
        entity_type,
        user_id,
        company_id,
        from,
        to,
        limit = 100,
      } = req.query;

      const where = [];
      const values = [];

      if (action) {
        values.push(action);
        where.push(`action = $${values.length}`);
      }

      if (entity_type) {
        values.push(entity_type);
        where.push(`entity_type = $${values.length}`);
      }

      if (user_id) {
        const userIdNum = Number(user_id);
        if (!Number.isNaN(userIdNum)) {
          values.push(userIdNum);
          where.push(`user_id = $${values.length}`);
        }
      }

      if (company_id) {
        const companyIdNum = Number(company_id);
        if (!Number.isNaN(companyIdNum)) {
          values.push(companyIdNum);
          where.push(`company_id = $${values.length}`);
        }
      }

      const fromIso = parseDate(from);
      const toIso = parseDate(to);

      if (fromIso) {
        values.push(fromIso);
        where.push(`created_at >= $${values.length}`);
      }
      if (toIso) {
        values.push(toIso);
        where.push(`created_at <= $${values.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const safeLimit = Math.min(Number(limit) || 100, 1000);
      values.push(safeLimit);
      const limitIndex = values.length;

      const result = await db.query(
        `SELECT
           id,
           created_at,
           user_id,
           company_id,
           action,
           entity_type,
           entity_id,
           metadata,
           ip,
           user_agent,
           request_id
         FROM audit_log
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${limitIndex}`,
        values
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("❌ Error en GET /api/logs/audit:", err);
      return res.status(500).json({
        message: "Error interno obteniendo audit_log",
      });
    }
  }
);

/**
 * GET /api/logs/auth
 * Lista eventos de auth_log con filtros básicos.
 *
 * Solo SUPER_ADMIN y ADMIN_GLOBAL.
 *
 * Query params opcionales:
 * - action: LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGE, etc.
 * - user_id: id de usuario
 * - run: RUN/RUT normalizado
 * - from: ISO date (incluyente)
 * - to: ISO date (incluyente)
 * - limit: máximo de filas (por defecto 100, máximo 1000)
 */
router.get(
  "/auth",
  requireAuth,
  requireRole("ADMIN_GLOBAL"),
  async (req, res) => {
    try {
      const { action, user_id, run, from, to, limit = 100 } = req.query;

      const where = [];
      const values = [];

      if (action) {
        values.push(action);
        where.push(`action = $${values.length}`);
      }

      if (user_id) {
        const userIdNum = Number(user_id);
        if (!Number.isNaN(userIdNum)) {
          values.push(userIdNum);
          where.push(`user_id = $${values.length}`);
        }
      }

      if (run) {
        values.push(run);
        where.push(`run = $${values.length}`);
      }

      const fromIso = parseDate(from);
      const toIso = parseDate(to);

      if (fromIso) {
        values.push(fromIso);
        where.push(`created_at >= $${values.length}`);
      }
      if (toIso) {
        values.push(toIso);
        where.push(`created_at <= $${values.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const safeLimit = Math.min(Number(limit) || 100, 1000);
      values.push(safeLimit);
      const limitIndex = values.length;

      const result = await db.query(
        `SELECT
           id,
           user_id,
           run,
           action,
           ip,
           user_agent,
           metadata,
           created_at
         FROM auth_log
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${limitIndex}`,
        values
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("❌ Error en GET /api/logs/auth:", err);
      return res.status(500).json({
        message: "Error interno obteniendo auth_log",
      });
    }
  }
);

module.exports = router;
