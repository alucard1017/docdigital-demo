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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 company_id:
 *                   type: integer
 *                 interval_days:
 *                   type: integer
 *                   description: Días entre recordatorios (1-30)
 *                 max_attempts:
 *                   type: integer
 *                   description: Máximo número de intentos (1-10)
 *                 enabled:
 *                   type: boolean
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval_days:
 *                 type: integer
 *                 description: Días entre recordatorios (1-30)
 *               max_attempts:
 *                 type: integer
 *                 description: Máximo número de intentos (1-10)
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configuración actualizada
 */
router.put(
  "/config",
  requireAuth,
  requireRole("ADMIN"),
  updateConfig
);

module.exports = router;
