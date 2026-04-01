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

  return {
    sql: conditions.length ? ` AND ${conditions.join(" AND ")}` : "",
    params,
    nextIndex: paramIndex,
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /api/analytics/company
 * Métricas de la empresa del usuario actual
 */
async function getCompanyAnalytics(req, res) {
  try {
    const companyId = req.user?.company_id;
    const { startDate, endDate } = req.query;

    if (!companyId) {
      return res.status(400).json({
        message: "No se pudo determinar la empresa del usuario autenticado",
      });
    }

    const docsFilter = buildDateFilter({
      startDate,
      endDate,
      initialParams: [companyId],
      initialIndex: 2,
      column: "created_at",
    });

    const docsRes = await query(
      `
      SELECT
        COUNT(*) FILTER (WHERE estado = 'BORRADOR')     AS borradores,
        COUNT(*) FILTER (WHERE estado = 'ENVIADO')      AS enviados,
        COUNT(*) FILTER (WHERE estado = 'EN_REVISION')  AS en_revision,
        COUNT(*) FILTER (WHERE estado = 'EN_FIRMA')     AS en_firma,
        COUNT(*) FILTER (WHERE estado = 'FIRMADO')      AS firmados,
        COUNT(*) FILTER (WHERE estado = 'RECHAZADO')    AS rechazados,
        COUNT(*) FILTER (WHERE estado = 'EXPIRADO')     AS expirados,
        COUNT(*)                                        AS total
      FROM documents
      WHERE company_id = $1
        AND deleted_at IS NULL
        ${docsFilter.sql}
      `,
      docsFilter.params
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
        COALESCE(
          ROUND(AVG(EXTRACT(EPOCH FROM (firmado_en - enviado_en))) / 3600.0, 1),
          0
        ) AS avg_hours
      FROM documents
      WHERE company_id = $1
        AND firmado_en IS NOT NULL
        AND enviado_en IS NOT NULL
        AND deleted_at IS NULL
        ${signedTimeFilter.sql}
      `,
      signedTimeFilter.params
    );

    const avgHours = toNumber(avgTimeRes.rows[0]?.avg_hours, 0);

    const totalDocs = toNumber(docStats.total, 0);
    const rejectedDocs = toNumber(docStats.rechazados, 0);
    const rejectionRate =
      totalDocs > 0 ? Number(((rejectedDocs / totalDocs) * 100).toFixed(1)) : 0;

    const monthlyFilter = buildDateFilter({
      startDate,
      endDate,
      initialParams: [companyId],
      initialIndex: 2,
      column: "created_at",
    });

    const monthlyQuery = startDate || endDate
      ? `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          COUNT(*)::int AS total
        FROM documents
        WHERE company_id = $1
          AND deleted_at IS NULL
          ${monthlyFilter.sql}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `
      : `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          COUNT(*)::int AS total
        FROM documents
        WHERE company_id = $1
          AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `;

    const monthlyParams = startDate || endDate ? monthlyFilter.params : [companyId];
    const monthlyRes = await query(monthlyQuery, monthlyParams);

    const topUsersFilter = buildDateFilter({
      startDate,
      endDate,
      initialParams: [companyId],
      initialIndex: 2,
      column: "d.created_at",
    });

    const topUsersRes = await query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(d.id)::int AS documentos_creados
      FROM users u
      LEFT JOIN documents d
        ON d.created_by = u.id
       AND d.deleted_at IS NULL
       ${topUsersFilter.sql}
      WHERE u.company_id = $1
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY documentos_creados DESC, u.name ASC
      LIMIT 5
      `,
      topUsersFilter.params
    );

    return res.json({
      summary: {
        total_documentos: totalDocs,
        borradores: toNumber(docStats.borradores, 0),
        enviados: toNumber(docStats.enviados, 0),
        en_revision: toNumber(docStats.en_revision, 0),
        en_firma: toNumber(docStats.en_firma, 0),
        firmados: toNumber(docStats.firmados, 0),
        rechazados: rejectedDocs,
        expirados: toNumber(docStats.expirados, 0),
        tiempo_promedio_firma_horas: avgHours,
        tasa_rechazo: rejectionRate,
      },
      monthly_stats: monthlyRes.rows || [],
      top_users: topUsersRes.rows || [],
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