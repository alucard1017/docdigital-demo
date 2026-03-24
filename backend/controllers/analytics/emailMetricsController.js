// backend/controllers/analytics/emailMetricsController.js
const { query } = require("../../db");

/**
 * GET /api/analytics/email-metrics
 * Obtener métricas de emails por documento o global
 */
async function getEmailMetrics(req, res) {
  try {
    const { documentoId, startDate, endDate } = req.query;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (documentoId) {
      whereConditions.push(`documento_id = $${paramIndex}`);
      params.push(Number(documentoId));
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereSql =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Métricas generales
    const metricsRes = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE event_type = 'sent') as emails_enviados,
         COUNT(*) FILTER (WHERE event_type = 'delivered') as emails_entregados,
         COUNT(*) FILTER (WHERE event_type = 'opened') as emails_abiertos,
         COUNT(*) FILTER (WHERE event_type = 'clicked') as emails_clicados,
         COUNT(*) FILTER (WHERE event_type = 'bounced') as emails_rebotados,
         COUNT(DISTINCT documento_id) as documentos_unicos,
         COUNT(DISTINCT email) as destinatarios_unicos
       FROM email_tracking
       ${whereSql}`,
      params
    );

    const metrics = metricsRes.rows[0] || {};

    const enviados = Number(metrics.emails_enviados || 0);
    const divisor = enviados > 0 ? enviados : 1;

    const tasaApertura = (
      (Number(metrics.emails_abiertos || 0) / divisor) *
      100
    ).toFixed(2);
    const tasaClick = (
      (Number(metrics.emails_clicados || 0) / divisor) *
      100
    ).toFixed(2);
    const tasaRebote = (
      (Number(metrics.emails_rebotados || 0) / divisor) *
      100
    ).toFixed(2);

    // Eventos recientes
    const recentEventsRes = await query(
      `SELECT 
         et.id,
         et.documento_id,
         et.email,
         et.event_type,
         et.created_at,
         d.titulo
       FROM email_tracking et
       JOIN documentos d ON d.id = et.documento_id
       ${whereSql}
       ORDER BY et.created_at DESC
       LIMIT 50`,
      params
    );

    return res.json({
      summary: {
        emails_enviados: Number(metrics.emails_enviados || 0),
        emails_entregados: Number(metrics.emails_entregados || 0),
        emails_abiertos: Number(metrics.emails_abiertos || 0),
        emails_clicados: Number(metrics.emails_clicados || 0),
        emails_rebotados: Number(metrics.emails_rebotados || 0),
        documentos_unicos: Number(metrics.documentos_unicos || 0),
        destinatarios_unicos: Number(metrics.destinatarios_unicos || 0),
        tasa_apertura: tasaApertura + "%",
        tasa_click: tasaClick + "%",
        tasa_rebote: tasaRebote + "%",
      },
      recent_events: recentEventsRes.rows,
    });
  } catch (err) {
    console.error("❌ Error obteniendo métricas de email:", err);
    return res.status(500).json({
      message: "Error obteniendo métricas de email",
    });
  }
}

/**
 * POST /api/analytics/email-event (webhook de Brevo/proveedor)
 * Recibir eventos de email (sent, opened, clicked, bounced)
 */
async function recordEmailEvent(req, res) {
  try {
    const { event, email, documentoId, trackingId, metadata } = req.body;

    if (!event || !email) {
      return res.status(400).json({
        message: "event y email son obligatorios",
      });
    }

    await query(
      `INSERT INTO email_tracking (
         documento_id,
         email,
         event_type,
         tracking_id,
         metadata,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        documentoId || null,
        email,
        event,
        trackingId || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    console.log(`📧 Evento de email registrado: ${event} → ${email}`);

    return res.json({ message: "Evento registrado" });
  } catch (err) {
    console.error("❌ Error registrando evento de email:", err);
    return res.status(500).json({
      message: "Error registrando evento de email",
    });
  }
}

module.exports = {
  getEmailMetrics,
  recordEmailEvent,
};
