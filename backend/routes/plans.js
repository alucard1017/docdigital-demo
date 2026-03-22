// backend/routes/plans.js
const express = require("express");
const { requireAuth } = require("./auth");
const {
  getPlans,
  getCurrentPlan,
} = require("../controllers/plans/plansController");

const router = express.Router();

/**
 * @openapi
 * /api/plans:
 *   get:
 *     summary: Obtener planes disponibles
 *     tags:
 *       - Planes
 *     responses:
 *       200:
 *         description: Lista de planes
 */
router.get("/", getPlans);

/**
 * @openapi
 * /api/plans/current:
 *   get:
 *     summary: Obtener plan actual de la empresa
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plan actual
 */
router.get("/current", requireAuth, getCurrentPlan);

module.exports = router;
