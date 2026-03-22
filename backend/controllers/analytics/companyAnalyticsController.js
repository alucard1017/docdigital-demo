// backend/controllers/analytics/companyAnalyticsController.js
const db = require("../../db");

/**
 * GET /api/analytics/company
 * Métricas de la empresa del usuario actual
 */
async function getCompanyAnalytics(req, res) {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    const params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      dateFilter += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      dateFilter += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Documentos por estado
    const docsRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE estado = 'BORRADOR') as borradores,
         COUNT(*) FILTER (WHERE estado = 'ENVIADO') as enviados,
         COUNT(*) FILTER (WHERE estado = 'EN_REVISION') as en_revision,
         COUNT(*) FILTER (WHERE estado = 'EN_FIRMA') as en_firma,
         COUNT(*) FILTER (WHERE estado = 'FIRMADO') as firmados,
         COUNT(*) FILTER (WHERE estado = 'RECHAZADO') as rechazados,
         COUNT(*) FILTER (WHERE estado = 'EXPIRADO') as expirados,
         COUNT(*) as total
       FROM documentos
       WHERE company_id = $1 AND deleted_at IS NULL ${dateFilter}`,
      params
    );

    const docStats = docsRes.rows[0];

    // Tiempo promedio de firma
    const avgTimeRes = await db.query(
      `SELECT 
         AVG(EXTRACT(EPOCH FROM (firmado_en - enviado_en))) / 3600 as avg_hours
       FROM documentos
       WHERE company_id = $1 
         AND firmado_en IS NOT NULL 
         AND enviado_en IS NOT NULL
         AND deleted_at IS NULL
         ${dateFilter}`,
      params
    );

    const avgHours = Number(avgTimeRes.rows[0]?.avg_hours || 0).toFixed(1);

    // Tasa de rechazo
    const totalDocs = Number(docStats.total);
    const rechazados = Number(docStats.rechazados);
    const tasaRechazo = totalDocs > 0 
      ? ((rechazados / totalDocs) * 100).toFixed(1)
      : "0.0";

    // Documentos por mes (últimos 6 meses)
    const monthlyRes = await db.query(
      `SELECT 
         TO_CHAR(created_at, 'YYYY-MM') as mes,
         COUNT(*) as total
       FROM documentos
       WHERE company_id = $1 
         AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY mes
       ORDER BY mes ASC`,
      [companyId]
    );

    // Top usuarios más activos
    const topUsersRes = await db.query(
      `SELECT 
         u.name,
         u.email,
         COUNT(d.id) as documentos_creados
       FROM users u
       LEFT JOIN documentos d ON d.creado_por = u.id AND d.deleted_at IS NULL
       WHERE u.company_id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id, u.name, u.email
       ORDER BY documentos_creados DESC
       LIMIT 5`,
      [companyId]
    );

    return res.json({
      summary: {
        total_documentos: Number(docStats.total),
        borradores: Number(docStats.borradores),
        enviados: Number(docStats.enviados),
        en_revision: Number(docStats.en_revision),
        en_firma: Number(docStats.en_firma),
        firmados: Number(docStats.firmados),
        rechazados: Number(docStats.rechazados),
        expirados: Number(docStats.expirados),
        tiempo_promedio_firma_horas: avgHours,
        tasa_rechazo: tasaRechazo + "%",
      },
      monthly_stats: monthlyRes.rows,
      top_users: topUsersRes.rows,
    });
  } catch (err) {
    console.error("❌ Error obteniendo analytics:", err);
    return res.status(500).json({ message: "Error obteniendo analytics" });
  }
}

module.exports = {
  getCompanyAnalytics,
};
