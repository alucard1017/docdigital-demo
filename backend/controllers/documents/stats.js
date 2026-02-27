// backend/controllers/documents/stats.js
const db = require('../../db');

function isGlobalAdmin(user) {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_GLOBAL';
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

    let targetCompanyId = null;
    let scopeLabel = 'global';

    if (isGlobalAdmin(user)) {
      if (queryCompanyId) {
        targetCompanyId = Number(queryCompanyId);
        scopeLabel = `company_${targetCompanyId}`;
      }
    } else {
      // ADMIN / USER obligatoriamente restringidos a su empresa
      if (!user.company_id) {
        return res
          .status(400)
          .json({ message: 'Tu usuario no tiene company_id asignado' });
      }
      targetCompanyId = user.company_id;
      scopeLabel = `company_${targetCompanyId}`;
    }

    const params = [];
    let whereSql = '';

    if (targetCompanyId) {
      params.push(targetCompanyId);
      whereSql = `WHERE company_id = $${params.length}`;
    }

    // KPIs por estado básico
    const kpiSql = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE status IN ('PENDIENTE','PENDIENTE_VISADO','PENDIENTE_FIRMA')
        ) AS pendientes,
        COUNT(*) FILTER (WHERE status = 'FIRMADO')   AS firmados,
        COUNT(*) FILTER (WHERE status = 'RECHAZADO') AS rechazados
      FROM documents
      ${whereSql}
    `;

    const kpiRes = await db.query(kpiSql, params);
    const kpis = kpiRes.rows[0] || {
      total: 0,
      pendientes: 0,
      firmados: 0,
      rechazados: 0,
    };

    // Documentos por día (últimos 30 días)
    const perDaySql = `
      SELECT
        to_char(created_at::date, 'YYYY-MM-DD') AS date,
        COUNT(*) AS count
      FROM documents
      ${whereSql}
        ${whereSql ? 'AND' : 'WHERE'} created_at >= NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY date ASC
    `;
    const perDayRes = await db.query(perDaySql, params);

    // Documentos por tipo_tramite (si tienes ese campo en documents)
    const tipoSql = `
      SELECT
        COALESCE(tipo_tramite, 'SIN_TIPO') AS tipo_tramite,
        COUNT(*) AS count
      FROM documents
      ${whereSql}
      GROUP BY tipo_tramite
      ORDER BY count DESC
    `;
    const tipoRes = await db.query(tipoSql, params);

    return res.json({
      scope: scopeLabel,
      company_id: targetCompanyId,
      kpis: {
        total: Number(kpis.total || 0),
        pendientes: Number(kpis.pendientes || 0),
        firmados: Number(kpis.firmados || 0),
        rechazados: Number(kpis.rechazados || 0),
      },
      perDay: perDayRes.rows.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      porTipoTramite: tipoRes.rows.map((r) => ({
        tipo_tramite: r.tipo_tramite,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    console.error('❌ Error obteniendo stats de documentos:', err);
    return res.status(500).json({ message: 'Error obteniendo estadísticas' });
  }
}

module.exports = { getDocumentStats };
