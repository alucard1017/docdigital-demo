const { db } = require("./common");
const { isGlobalAdmin, normalizeStatus } = require("./documentHelpers");

const pool = db?.pool || db;

async function getUserDocuments(req, res) {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const {
      status,
      search,
      page = 1,
      limit = 20,
      company_id: queryCompanyId,
      sort = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const allowedSortFields = {
      created_at: "d.created_at",
      updated_at: "d.updated_at",
      title: "d.title",
      status: "d.status",
    };

    const sortField = allowedSortFields[sort] || "d.created_at";
    const sortDirection =
      String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const values = [];
    const where = [];

    if (isGlobalAdmin(user)) {
      if (queryCompanyId) {
        const companyIdNum = Number(queryCompanyId);
        if (!Number.isNaN(companyIdNum)) {
          values.push(companyIdNum);
          where.push(`d.company_id = $${values.length}`);
        }
      }
    } else {
      if (!user.company_id) {
        return res.status(400).json({
          message: "Tu usuario no tiene company_id asignado",
        });
      }

      values.push(user.company_id);
      where.push(`d.company_id = $${values.length}`);
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      values.push(normalizedStatus);
      where.push(`UPPER(d.status) = $${values.length}`);
    }

    if (search && String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where.push(`(
        d.title ILIKE $${values.length}
        OR COALESCE(d.description, '') ILIKE $${values.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE d.status IN ('PENDIENTE','PENDIENTE_VISADO','PENDIENTE_FIRMA')
        ) AS pendientes,
        COUNT(*) FILTER (WHERE d.status = 'VISADO') AS visados,
        COUNT(*) FILTER (WHERE d.status = 'FIRMADO') AS firmados,
        COUNT(*) FILTER (WHERE d.status = 'RECHAZADO') AS rechazados
      FROM documents d
      ${whereSql}
    `;

    const countResult = await pool.query(countSql, values);
    const countRow = countResult.rows[0] || {};

    const total = Number(countRow.total || 0);
    const stats = {
      total,
      pendientes: Number(countRow.pendientes || 0),
      visados: Number(countRow.visados || 0),
      firmados: Number(countRow.firmados || 0),
      rechazados: Number(countRow.rechazados || 0),
    };

    values.push(limitNum);
    const limitIndex = values.length;

    values.push(offset);
    const offsetIndex = values.length;

    const dataSql = `
      SELECT
        d.id,
        d.title,
        d.description,
        d.status,
        d.company_id,
        d.created_by,
        d.created_at,
        d.updated_at,
        d.verification_code,
        d.nuevo_documento_id,
        d.tipo_tramite,
        COALESCE(
          doc.numero_contrato_interno,
          d.metadata->>'numeroContratoInterno'
        ) AS numero_contrato_interno,
        COALESCE(s.signers_count, 0) AS signers_count
      FROM documents d
      LEFT JOIN documentos doc
        ON doc.id = d.nuevo_documento_id
      LEFT JOIN (
        SELECT document_id, COUNT(*) AS signers_count
        FROM document_signers
        GROUP BY document_id
      ) s ON s.document_id = d.id
      ${whereSql}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `;

    const dataResult = await pool.query(dataSql, values);

    console.log("[getUserDocuments] QUERY PARAMS:", {
      rawQuery: req.query,
      page: pageNum,
      limit: limitNum,
      offset,
      total,
      sort,
      order,
      sortField,
      sortDirection,
      normalizedStatus,
      search: search || null,
    });

    return res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        hasNextPage: offset + limitNum < total,
        hasPrevPage: pageNum > 1,
      },
      stats,
      filters: {
        status: normalizedStatus,
        search: search || null,
        company_id:
          queryCompanyId || (isGlobalAdmin(user) ? null : user.company_id),
        sort,
        order: sortDirection.toLowerCase(),
      },
    });
  } catch (err) {
    console.error("❌ Error obteniendo documentos del usuario:", err);
    return res.status(500).json({ message: "Error obteniendo documentos" });
  }
}

module.exports = {
  getUserDocuments,
};