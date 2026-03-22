// backend/controllers/documents/remindersAdmin.js
const { db } = require("./common");
const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../../utils/auditLog");

/**
 * GET /api/recordatorios/status
 * Ver estado de todos los recordatorios de un documento o globales (admin)
 */
async function getReminderStatus(req, res) {
  try {
    const { documentoId } = req.query;

    let query = `
      SELECT 
        r.id,
        r.documento_id,
        r.email,
        r.tipo,
        r.status,
        r.scheduled_at,
        r.sent_at,
        r.attempt,
        r.max_attempts,
        r.error_message,
        r.created_at,
        d.titulo,
        d.estado as documento_estado
      FROM recordatorios r
      JOIN documentos d ON d.id = r.documento_id
    `;

    const params = [];

    if (documentoId) {
      query += ` WHERE r.documento_id = $1`;
      params.push(Number(documentoId));
    }

    query += ` ORDER BY r.created_at DESC LIMIT 1000`;

    const result = await db.query(query, params);

    const resumen = {
      total: result.rowCount,
      por_estado: {
        PENDING: result.rows.filter((r) => r.status === "PENDING").length,
        SENT: result.rows.filter((r) => r.status === "SENT").length,
        FAILED: result.rows.filter((r) => r.status === "FAILED").length,
        CANCELLED: result.rows.filter((r) => r.status === "CANCELLED").length,
      },
      recordatorios: result.rows,
    };

    await logAudit({
      user: req.user,
      action: "REMINDERS_STATUS_VIEWED",
      entityType: "reminder",
      entityId: documentoId ? Number(documentoId) : null,
      metadata: {
        total: resumen.total,
        filter: documentoId ? { documentoId } : "all",
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

/**
 * POST /api/recordatorios/reintentar/:recordatorioId
 * Reintentar envío de un recordatorio fallido
 */
async function retryReminder(req, res) {
  try {
    const { recordatorioId } = req.params;

    const remRes = await db.query(
      `SELECT * FROM recordatorios WHERE id = $1`,
      [Number(recordatorioId)]
    );

    if (remRes.rowCount === 0) {
      return res.status(404).json({ message: "Recordatorio no encontrado" });
    }

    const reminder = remRes.rows[0];

    if (reminder.status === "SENT") {
      return res.status(400).json({
        message: "Este recordatorio ya fue enviado exitosamente",
      });
    }

    // Resetear scheduled_at a ahora para que se reenvíe pronto
    await db.query(
      `UPDATE recordatorios
       SET status = 'PENDING',
           scheduled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [Number(recordatorioId)]
    );

    await logAudit({
      user: req.user,
      action: "REMINDER_RETRY_REQUESTED",
      entityType: "reminder",
      entityId: Number(recordatorioId),
      metadata: {
        documento_id: reminder.documento_id,
        email: reminder.email,
        previous_status: reminder.status,
      },
      req,
    });

    return res.json({
      message: "Recordatorio marcado para reintentar",
      recordatorioId: Number(recordatorioId),
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
