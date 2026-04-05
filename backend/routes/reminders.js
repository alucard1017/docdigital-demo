// backend/routes/reminders.js
const express = require("express");
const { requireAuth, requireRole } = require("./auth");
const {
  getConfig,
  updateConfig,
} = require("../controllers/reminders/reminderConfigController");

const router = express.Router();

/**
 * @openapi
 * /api/reminders/config:
 *   get:
 *     summary: Obtener configuración de recordatorios de la empresa
 *     tags:
 *       - Recordatorios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración de recordatorios
 */
router.get("/config", requireAuth, getConfig);

/**
 * @openapi
 * /api/reminders/config:
 *   put:
 *     summary: Actualizar configuración de recordatorios (ADMIN)
 *     tags:
 *       - Recordatorios
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/config",
  requireAuth,
  requireRole("ADMIN"),
  updateConfig
);

module.exports = router;