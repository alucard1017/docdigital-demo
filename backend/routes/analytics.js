// backend/routes/analytics.js
const express = require("express");
const router = express.Router();

// Ajusta la ruta del middleware según lo tengas definido.
// Si tu middleware está en backend/middleware/auth.js:
const { requireAuth } = require("./auth");

const {
  getEmailMetrics,
  recordEmailEvent,
} = require("../controllers/analytics/emailMetricsController");

const {
  getCompanyAnalytics,
} = require("../controllers/analytics/companyAnalyticsController");

/**
 * @openapi
 * /api/analytics/company:
 *   get:
 *     summary: Obtener analytics agregados por empresa
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas de la empresa
 */
router.get("/company", requireAuth, getCompanyAnalytics);

/**
 * @openapi
 * /api/analytics/email-metrics:
 *   get:
 *     summary: Obtener métricas de emails (aperturas, clicks, rebotes)
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: documentoId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas de emails
 */
router.get("/email-metrics", requireAuth, getEmailMetrics);

/**
 * @openapi
 * /api/analytics/email-event:
 *   post:
 *     summary: Webhook para recibir eventos de email (Brevo/SendGrid)
 *     tags:
 *       - Analytics
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [sent, delivered, opened, clicked, bounced]
 *               email:
 *                 type: string
 *               documentoId:
 *                 type: integer
 *               trackingId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Evento registrado
 */
router.post("/email-event", recordEmailEvent);

module.exports = router;
