// backend/controllers/documents/stats.js
const db = require("../../db");

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalCompanyId(value) {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "company_id inválido" };
  }

  return { value: parsed };
}

function buildScope(user, queryCompanyId) {
  if (isGlobalAdmin(user)) {
    const parsed = parseOptionalCompanyId(queryCompanyId);

    if (parsed?.error) {
      return { error: parsed.error };
    }

    const targetCompanyId = parsed?.value ?? null;

    return {
      targetCompanyId,
      scopeLabel: targetCompanyId ? `company_${targetCompanyId}` : "global",
    };
  }

  if (!user?.company_id) {
    return { error: "Tu usuario no tiene company_id asignado" };
  }

  return {
    targetCompanyId: user.company_id,
    scopeLabel: `company_${user.company_id}`,
  };
}

function buildWhereClause(targetCompanyId) {
  if (!targetCompanyId) {
    return {
      whereSql: "",
      params: [],
    };
  }

  return {
    whereSql: "WHERE company_id = $1",
    params: [targetCompanyId],
  };
}

/**
 * GET /api/docs/stats
 *
 * SUPER_ADMIN / ADMIN_GLOBAL:
 *   - sin query -> stats globales
 *   - ?company_id=XX -> stats de esa empresa
 *
 * ADMIN / USER:
 *   - siempre stats de su propia company_id
 */
async function getDocumentStats(req, res) {
  try {
    const user = req.user;
    const { company_id: queryCompanyId } = req.query;

    const scope = buildScope(user, queryCompanyId);

    if (scope?.error) {
      return res.status(400).json({ message: scope.error });
    }

    const { targetCompanyId, scopeLabel } = scope;
    const { whereSql, params } = buildWhereClause(targetCompanyId);

    const andCreatedLast30Days = whereSql
      ? `${whereSql} AND created_at >= NOW() - INTERVAL '30 days'`
      : `WHERE created_at >= NOW() - INTERVAL '30 days'`;

    const kpiSql = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE status IN ('PENDIENTE', 'PENDIENTE_VISADO', 'PENDIENTE_FIRMA')
        ) AS pendientes,
        COUNT(*) FILTER (WHERE status = 'VISADO') AS visados,
        COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados,
        COUNT(*) FILTER (WHERE status = 'RECHAZADO') AS rechazados
      FROM documents
      ${whereSql}
    `;

    const perDaySql = `
      SELECT
        to_char(created_at::date, 'YYYY-MM-DD') AS date,
        COUNT(*) AS count
      FROM documents
      ${andCreatedLast30Days}
      GROUP BY created_at::date
      ORDER BY date ASC
    `;

    const tipoSql = `
      SELECT
        COALESCE(NULLIF(tipo_tramite, ''), 'SIN_TIPO') AS tipo_tramite,
        COUNT(*) AS count
      FROM documents
      ${whereSql}
      GROUP BY COALESCE(NULLIF(tipo_tramite, ''), 'SIN_TIPO')
      ORDER BY count DESC, tipo_tramite ASC
    `;

    const [kpiRes, perDayRes, tipoRes] = await Promise.all([
      db.query(kpiSql, params),
      db.query(perDaySql, params),
      db.query(tipoSql, params),
    ]);

    const kpisRow = kpiRes.rows[0] || {};

    return res.json({
      scope: scopeLabel,
      company_id: targetCompanyId,
      kpis: {
        total: toSafeNumber(kpisRow.total),
        pendientes: toSafeNumber(kpisRow.pendientes),
        visados: toSafeNumber(kpisRow.visados),
        firmados: toSafeNumber(kpisRow.firmados),
        rechazados: toSafeNumber(kpisRow.rechazados),
      },
      perDay: perDayRes.rows.map((row) => ({
        date: row.date,
        count: toSafeNumber(row.count),
      })),
      porTipoTramite: tipoRes.rows.map((row) => ({
        tipo_tramite: row.tipo_tramite,
        count: toSafeNumber(row.count),
      })),
    });
  } catch (err) {
    console.error("❌ Error obteniendo stats de documentos:", err);
    return res.status(500).json({ message: "Error obteniendo estadísticas" });
  }
}

module.exports = { getDocumentStats };