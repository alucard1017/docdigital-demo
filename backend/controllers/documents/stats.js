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
  if (value == null || value === "") {
    return { value: null, error: null };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { value: null, error: "company_id inválido" };
  }

  return { value: parsed, error: null };
}

function buildScope(user, queryCompanyId) {
  if (isGlobalAdmin(user)) {
    const { value, error } = parseOptionalCompanyId(queryCompanyId);

    if (error) {
      return { error };
    }

    const targetCompanyId = value ?? null;

    return {
      targetCompanyId,
      scopeLabel: targetCompanyId ? `company_${targetCompanyId}` : "global",
      error: null,
    };
  }

  if (!user?.company_id) {
    return { error: "Tu usuario no tiene company_id asignado" };
  }

  return {
    targetCompanyId: user.company_id,
    scopeLabel: `company_${user.company_id}`,
    error: null,
  };
}

function buildWhereClause(targetCompanyId, tableAlias = "") {
  const prefix = tableAlias ? `${tableAlias}.` : "";

  if (!targetCompanyId) {
    return {
      whereSql: "",
      params: [],
    };
  }

  return {
    whereSql: `WHERE ${prefix}company_id = $1`,
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

    const baseWhere = whereSql || "";
    const perDayWhere = baseWhere
      ? `${baseWhere} AND created_at >= NOW() - INTERVAL '30 days'`
      : "WHERE created_at >= NOW() - INTERVAL '30 days'";

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
      ${baseWhere}
    `;

    const perDaySql = `
      SELECT
        to_char(created_at::date, 'YYYY-MM-DD') AS date,
        COUNT(*) AS count
      FROM documents
      ${perDayWhere}
      GROUP BY created_at::date
      ORDER BY date ASC
    `;

    const tipoSql = `
      SELECT
        COALESCE(NULLIF(tipo_tramite, ''), 'SIN_TIPO') AS tipo_tramite,
        COUNT(*) AS count
      FROM documents
      ${baseWhere}
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

/**
 * GET /api/docs/stats/overview
 *
 * Pensado para las cards del Dashboard:
 * - Totales por estado normalizado
 * - Firmados / rechazados hoy
 * - Firmados / rechazados últimos 7 días (serie simple)
 */
async function getDocumentStatsOverview(req, res) {
  try {
    const user = req.user;
    const { company_id: queryCompanyId } = req.query;

    const scope = buildScope(user, queryCompanyId);

    if (scope?.error) {
      return res.status(400).json({ message: scope.error });
    }

    const { targetCompanyId, scopeLabel } = scope;
    const { whereSql, params } = buildWhereClause(targetCompanyId, "d");

    // Totales por estado
    const totalsSql = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE d.status IN ('PENDIENTE', 'PENDIENTE_VISADO', 'PENDIENTE_FIRMA')
        ) AS pending_signature,
        COUNT(*) FILTER (WHERE d.status = 'PENDIENTE_VISADO') AS pending_review,
        COUNT(*) FILTER (WHERE d.status = 'FIRMADO') AS signed,
        COUNT(*) FILTER (WHERE d.status = 'RECHAZADO') AS rejected
      FROM documents d
      ${whereSql}
    `;

    // Firmados / rechazados hoy
    const todaySql = `
      SELECT
        COUNT(*) FILTER (WHERE d.status = 'FIRMADO') AS signed_today,
        COUNT(*) FILTER (WHERE d.status = 'RECHAZADO') AS rejected_today
      FROM documents d
      ${whereSql ? `${whereSql} AND d.updated_at::date = CURRENT_DATE` : "WHERE d.updated_at::date = CURRENT_DATE"}
    `;

    // Firmados / rechazados últimos 7 días (por fecha de updated_at)
    const last7Sql = `
      SELECT
        to_char(d.updated_at::date, 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE d.status = 'FIRMADO') AS signed,
        COUNT(*) FILTER (WHERE d.status = 'RECHAZADO') AS rejected
      FROM documents d
      ${
        whereSql
          ? `${whereSql} AND d.updated_at >= CURRENT_DATE - INTERVAL '6 days'`
          : "WHERE d.updated_at >= CURRENT_DATE - INTERVAL '6 days'"
      }
      GROUP BY d.updated_at::date
      ORDER BY date ASC
    `;

    const [totalsRes, todayRes, last7Res] = await Promise.all([
      db.query(totalsSql, params),
      db.query(todaySql, params),
      db.query(last7Sql, params),
    ]);

    const totalsRow = totalsRes.rows[0] || {};
    const todayRow = todayRes.rows[0] || {};

    return res.json({
      scope: scopeLabel,
      company_id: targetCompanyId,
      totals: {
        all: toSafeNumber(totalsRow.total),
        pending_signature: toSafeNumber(totalsRow.pending_signature),
        pending_review: toSafeNumber(totalsRow.pending_review),
        signed: toSafeNumber(totalsRow.signed),
        rejected: toSafeNumber(totalsRow.rejected),
      },
      today: {
        signed: toSafeNumber(todayRow.signed_today),
        rejected: toSafeNumber(todayRow.rejected_today),
      },
      last7: last7Res.rows.map((row) => ({
        date: row.date,
        signed: toSafeNumber(row.signed),
        rejected: toSafeNumber(row.rejected),
      })),
    });
  } catch (err) {
    console.error("❌ Error obteniendo stats overview de documentos:", err);
    return res
      .status(500)
      .json({ message: "Error obteniendo estadísticas de overview" });
  }
}

module.exports = {
  getDocumentStats,
  getDocumentStatsOverview,
};