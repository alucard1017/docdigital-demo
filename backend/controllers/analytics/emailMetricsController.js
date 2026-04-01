// backend/controllers/analytics/emailMetricsController.js
const { query } = require("../../db");

function buildWhereClause({ documentoId, startDate, endDate }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (documentoId) {
    conditions.push(`et.documento_id = $${paramIndex}`);
    params.push(Number(documentoId));
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`et.created_at >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`et.created_at <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/**
 * GET /api/analytics/email-metrics
 * Obtener métricas de emails por documento o global
 */
async function getEmailMetrics(req, res) {
  try {
    const { documentoId, startDate, endDate } = req.query;

    const { whereSql, params } = buildWhereClause({
      documentoId,
      startDate,
      endDate,
    });

    const metricsRes = await query(
      `
      SELECT
        COUNT(*) FILTER (WHERE et.event_type = 'sent')      AS emails_enviados,
        COUNT(*) FILTER (WHERE et.event_type = 'delivered') AS emails_entregados,
        COUNT(*) FILTER (WHERE et.event_type = 'opened')    AS emails_abiertos,
        COUNT(*) FILTER (WHERE et.event_type = 'clicked')   AS emails_clicados,
        COUNT(*) FILTER (WHERE et.event_type = 'bounced')   AS emails_rebotados,
        COUNT(DISTINCT et.documento_id) AS documentos_unicos,
        COUNT(DISTINCT et.email)        AS destinatarios_unicos
      FROM email_tracking et
      ${whereSql}
      `,
      params
    );

    const metrics = metricsRes.rows[0] || {};

    const emailsEnviados = Number(metrics.emails_enviados || 0);
    const emailsEntregados = Number(metrics.emails_entregados || 0);
    const emailsAbiertos = Number(metrics.emails_abiertos || 0);
    const emailsClicados = Number(metrics.emails_clicados || 0);
    const emailsRebotados = Number(metrics.emails_rebotados || 0);

    const divisor = emailsEnviados > 0 ? emailsEnviados : 1;

    const tasaApertura =
      emailsEnviados > 0
        ? Number(((emailsAbiertos / divisor) * 100).toFixed(2))
        : 0;
    const tasaClick =
      emailsEnviados > 0
        ? Number(((emailsClicados / divisor) * 100).toFixed(2))
        : 0;
    const tasaRebote =
      emailsEnviados > 0
        ? Number(((emailsRebotados / divisor) * 100).toFixed(2))
        : 0;

    const recentEventsRes = await query(
      `
      SELECT
        et.id,
        et.documento_id,
        et.email,
        et.event_type,
        et.created_at,
        d.title
      FROM email_tracking et
      LEFT JOIN documents d ON d.id = et.documento_id
      ${whereSql}
      ORDER BY et.created_at DESC
      LIMIT 50
      `,
      params
    );

    return res.json({
      summary: {
        emails_enviados: emailsEnviados,
        emails_entregados: emailsEntregados,
        emails_abiertos: emailsAbiertos,
        emails_clicados: emailsClicados,
        emails_reboteados: emailsRebotados,
        documentos_unicos: Number(metrics.documentos_unicos || 0),
        destinatarios_unicos: Number(metrics.destinatarios_unicos || 0),
        tasa_apertura: tasaApertura,
        tasa_click: tasaClick,
        tasa_rebote: tasaRebote,
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
 * POST /api/analytics/email-event
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
      `
      INSERT INTO email_tracking (
        documento_id,
        email,
        event_type,
        tracking_id,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        documentoId ? Number(documentoId) : null,
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