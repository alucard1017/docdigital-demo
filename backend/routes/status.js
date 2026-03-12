// backend/routes/status.js
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("./auth");

const router = express.Router();

/**
 * GET /api/status/metrics
 * Métricas rápidas para panel de Estado (solo ADMIN+).
 */
router.get("/metrics", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const now = new Date().toISOString();

    // 1) Logins fallidos últimos 60 minutos
    const failedLoginsRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM auth_log
       WHERE action = 'login_failed'
         AND created_at >= NOW() - INTERVAL '60 minutes'`
    );

    // 2) Logins exitosos últimos 60 minutos
    const successLoginsRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM auth_log
       WHERE action = 'login_success'
         AND created_at >= NOW() - INTERVAL '60 minutes'`
    );

    // 3) Acciones de documentos últimos 60 minutos
    const docActionsRes = await db.query(
      `SELECT action, COUNT(*)::int AS total
       FROM audit_log
       WHERE entity_type = 'document'
         AND created_at >= NOW() - INTERVAL '60 minutes'
       GROUP BY action
       ORDER BY total DESC`
    );

    // 4) Usuarios creados últimos 24h
    const usersLast24hRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_log
       WHERE entity_type = 'user'
         AND action IN ('user_registered_public', 'user_created')
         AND created_at >= NOW() - INTERVAL '24 hours'`
    );

    return res.json({
      generated_at: now,
      auth: {
        failed_logins_last_60m: failedLoginsRes.rows[0].total,
        success_logins_last_60m: successLoginsRes.rows[0].total,
      },
      documents: {
        actions_last_60m: docActionsRes.rows,
      },
      users: {
        created_last_24h: usersLast24hRes.rows[0].total,
      },
    });
  } catch (err) {
    console.error("❌ Error en GET /api/status/metrics:", err);
    return res.status(500).json({
      message: "Error interno obteniendo métricas",
    });
  }
});

module.exports = router;
