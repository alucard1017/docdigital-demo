// backend/controllers/analytics/companyAnalyticsController.js
const { query } = require("../../db");

function buildDateFilter({
  startDate,
  endDate,
  initialParams = [],
  initialIndex = 1,
  column = "created_at",
}) {
  const conditions = [];
  const params = [...initialParams];
  let paramIndex = initialIndex;

  if (startDate) {
    conditions.push(`${column} >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`${column} <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  const sql = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
  return { sql, params };
}

/**
 * GET /api/analytics/company
 * Métricas de la empresa del usuario actual
 */
async function getCompanyAnalytics(req, res) {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    const createdAtFilter = buildDateFilter({
      startDate,
      endDate,
      initialParams: [companyId],
      initialIndex: 2,
      column: "created_at",
    });

    const docsRes = await query(
      `
      SELECT
        COUNT(*) FILTER (WHERE estado = 'BORRADOR')   AS borradores,
        COUNT(*) FILTER (WHERE estado = 'ENVIADO')    AS enviados,
        COUNT(*) FILTER (WHERE estado = 'EN_REVISION') AS en_revision,
        COUNT(*) FILTER (WHERE estado = 'EN_FIRMA')   AS en_firma,
        COUNT(*) FILTER (WHERE estado = 'FIRMADO')    AS firmados,
        COUNT(*) FILTER (WHERE estado = 'RECHAZADO')  AS rechazados,
        COUNT(*) FILTER (WHERE estado = 'EXPIRADO')   AS expirados,
        COUNT(*) AS total
      FROM documents
      WHERE company_id = $1
        AND deleted_at IS NULL
        ${createdAtFilter.sql}
      `,
      createdAtFilter.params
    );

    const docStats = docsRes.rows[0] || {};

    const signedTimeFilter = buildDateFilter({
      startDate,
      endDate,
      initialParams: [companyId],
      initialIndex: 2,
      column: "enviado_en",
    });

    const avgTimeRes = await query(
      `
      SELECT
        AVG(EXTRACT(EPOCH FROM (firmado_en - enviado_en))) / 3600 AS avg_hours
      FROM documents
      WHERE company_id = $1
        AND firmado_en IS NOT NULL
        AND enviado_en IS NOT NULL
        AND deleted_at IS NULL
        ${signedTimeFilter.sql}
      `,
      signedTimeFilter.params
    );

    const avgHours = Number(avgTimeRes.rows[0]?.avg_hours || 0).toFixed(1);

    const totalDocs = Number(docStats.total || 0);
    const rejectedDocs = Number(docStats.rechazados || 0);
    const rejectionRate =
      totalDocs > 0 ? ((rejectedDocs / totalDocs) * 100).toFixed(1) : "0.0";

    const monthlyRes = await query(
      `
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS mes,
        COUNT(*) AS total
      FROM documents
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY mes
      ORDER BY mes ASC
      `,
      [companyId]
    );

    const topUsersRes = await query(
      `
      SELECT
        u.name,
        u.email,
        COUNT(d.id) AS documentos_creados
      FROM users u
      LEFT JOIN documents d
        ON d.creado_por = u.id
       AND d.deleted_at IS NULL
      WHERE u.company_id = $1
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY documentos_creados DESC, u.name ASC
      LIMIT 5
      `,
      [companyId]
    );

    return res.json({
      summary: {
        total_documentos: Number(docStats.total || 0),
        borradores: Number(docStats.borradores || 0),
        enviados: Number(docStats.enviados || 0),
        en_revision: Number(docStats.en_revision || 0),
        en_firma: Number(docStats.en_firma || 0),
        firmados: Number(docStats.firmados || 0),
        rechazados: Number(docStats.rechazados || 0),
        expirados: Number(docStats.expirados || 0),
        tiempo_promedio_firma_horas: avgHours,
        tasa_rechazo: `${rejectionRate}%`,
      },
      monthly_stats: monthlyRes.rows,
      top_users: topUsersRes.rows,
    });
  } catch (err) {
    console.error("❌ Error obteniendo analytics de empresa:", err);
    return res.status(500).json({
      message: "Error obteniendo analytics de empresa",
    });
  }
}

module.exports = {
  getCompanyAnalytics,
};