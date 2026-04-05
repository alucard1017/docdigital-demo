// backend/controllers/documents/remindersAdmin.js
const { db } = require("./common");
const { logAudit } = require("../../utils/auditLog");

function normalizeEstadoCanon(value) {
  const v = String(value || "").trim().toLowerCase();

  if (["pending", "pendiente"].includes(v)) return "pendiente";
  if (["sent", "enviado"].includes(v)) return "enviado";
  if (["failed", "fallido"].includes(v)) return "fallido";
  if (["cancelled", "canceled", "cancelado"].includes(v)) return "cancelado";

  return v || "pendiente";
}

/**
 * GET /api/recordatorios/status
 */
async function getReminderStatus(req, res) {
  try {
    const { documentoId } = req.query;

    let query = `
      SELECT 
        r.id,
        r.documento_id,
        r.company_id,
        r.firmante_id,
        COALESCE(r.destinatario_email, r.email) AS destinatario_email,
        r.tipo,
        COALESCE(
          NULLIF(LOWER(r.estado), ''),
          NULLIF(LOWER(r.status), ''),
          'pendiente'
        ) AS estado_canon,
        COALESCE(r.proximo_intento_at, r.scheduled_at) AS proximo_intento_at,
        r.sent_at,
        COALESCE(r.intentos, r.attempt, 0) AS intentos,
        COALESCE(r.max_intentos, r.max_attempts, 3) AS max_intentos,
        r.error_message,
        r.created_at,
        r.updated_at,
        d.title AS titulo,
        d.estado AS documento_estado
      FROM recordatorios r
      JOIN documents d ON d.id = r.documento_id
    `;

    const params = [];

    if (documentoId) {
      query += ` WHERE r.documento_id = $1`;
      params.push(Number(documentoId));
    }

    query += `
      ORDER BY
        COALESCE(r.proximo_intento_at, r.scheduled_at) ASC NULLS LAST,
        r.created_at DESC
      LIMIT 1000
    `;

    const result = await db.query(query, params);

    const rows = result.rows.map((row) => ({
      ...row,
      estado_canon: normalizeEstadoCanon(row.estado_canon),
    }));

    const resumen = {
      total: rows.length,
      por_estado: {
        pendiente: rows.filter((r) => r.estado_canon === "pendiente").length,
        enviado: rows.filter((r) => r.estado_canon === "enviado").length,
        fallido: rows.filter((r) => r.estado_canon === "fallido").length,
        cancelado: rows.filter((r) => r.estado_canon === "cancelado").length,
      },
      recordatorios: rows,
    };

    await logAudit({
      user: req.user,
      action: "REMINDERS_STATUS_VIEWED",
      entityType: "reminder",
      entityId: documentoId ? Number(documentoId) : null,
      metadata: {
        total: resumen.total,
        filter: documentoId ? { documentoId: Number(documentoId) } : "all",
      },
      req,
    });

    return res.json(resumen);
  } catch (err) {
    console.error("❌ Error obteniendo status de recordatorios:", err);
    return res.status(500).json({
      message: "Error obteniendo status de recordatorios",
    });
  }
}

async function retryReminder(req, res) {
  try {
    const { recordatorioId } = req.params;
    const reminderId = Number(recordatorioId);

    if (!Number.isFinite(reminderId) || reminderId <= 0) {
      return res.status(400).json({ message: "ID de recordatorio inválido" });
    }

    const remRes = await db.query(
      `
      SELECT
        id,
        documento_id,
        company_id,
        firmante_id,
        destinatario_email,
        email,
        estado,
        status,
        proximo_intento_at,
        scheduled_at,
        intentos,
        attempt,
        max_intentos,
        max_attempts
      FROM recordatorios
      WHERE id = $1
      `,
      [reminderId]
    );

    if (remRes.rowCount === 0) {
      return res.status(404).json({ message: "Recordatorio no encontrado" });
    }

    const reminder = remRes.rows[0];

    const estadoCanon = normalizeEstadoCanon(
      reminder.estado || reminder.status
    );

    if (estadoCanon === "enviado") {
      return res.status(400).json({
        message: "Este recordatorio ya fue enviado exitosamente",
      });
    }

    if (estadoCanon === "cancelado") {
      return res.status(400).json({
        message: "Este recordatorio está cancelado y no puede reintentarse",
      });
    }

    await db.query(
      `
      UPDATE recordatorios
      SET
        estado = 'pendiente',
        status = 'PENDING',
        proximo_intento_at = NOW(),
        scheduled_at = NOW(),
        error_message = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [reminderId]
    );

    await logAudit({
      user: req.user,
      action: "REMINDER_RETRY_REQUESTED",
      entityType: "reminder",
      entityId: reminderId,
      metadata: {
        documento_id: reminder.documento_id,
        company_id: reminder.company_id || null,
        firmante_id: reminder.firmante_id || null,
        destinatario_email:
          reminder.destinatario_email || reminder.email || null,
        previous_estado: reminder.estado || null,
        previous_status: reminder.status || null,
        previous_estado_canon: estadoCanon,
      },
      req,
    });

    return res.json({
      message: "Recordatorio marcado para reintentar",
      recordatorioId: reminderId,
    });
  } catch (err) {
    console.error("❌ Error reintentando recordatorio:", err);
    return res.status(500).json({
      message: "Error reintentando recordatorio",
    });
  }
}

module.exports = {
  getReminderStatus,
  retryReminder,
};