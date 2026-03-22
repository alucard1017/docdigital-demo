// backend/jobs/reminderScheduler.js
const cron = require("node-cron");
const db = require("../db");
const {
  sendSigningInvitation,
} = require("../services/emailService");

const FRONT_BASE_URL =
  process.env.FRONTEND_URL || "https://docdigital-demo.onrender.com";

function buildPublicSignUrl(token) {
  return `${FRONT_BASE_URL}/firma-publica?token=${token}`;
}

/**
 * Procesa recordatorios pendientes:
 * - Busca recordatorios con scheduled_at <= NOW()
 * - Intenta enviar email
 * - Actualiza status y attempt
 */
async function procesarRecordatoriosPendientes() {
  try {
    console.log("⏰ Iniciando procesamiento de recordatorios pendientes...");

    // Buscar recordatorios listos para enviar
    const recordatoriosRes = await db.query(
      `SELECT 
         r.id,
         r.documento_id,
         r.firmante_id,
         r.email,
         r.attempt,
         r.max_attempts,
         d.titulo,
         f.id as token_firmante_id
       FROM recordatorios r
       JOIN documentos d ON d.id = r.documento_id
       LEFT JOIN firmantes f ON f.id = r.firmante_id
       WHERE r.status = 'PENDING'
         AND r.scheduled_at <= NOW()
         AND r.attempt < r.max_attempts
       ORDER BY r.scheduled_at ASC
       LIMIT 100`
    );

    const recordatorios = recordatoriosRes.rows;
    console.log(
      `📬 Encontrados ${recordatorios.length} recordatorios para procesar`
    );

    let enviados = 0;
    let fallidos = 0;

    for (const rec of recordatorios) {
      try {
        const url = buildPublicSignUrl(rec.token_firmante_id);

        // Enviar email
        await sendSigningInvitation(
          rec.email,
          rec.titulo,
          url,
          rec.email.split("@")[0]
        );

        // Marcar como SENT
        await db.query(
          `UPDATE recordatorios
           SET status = 'SENT',
               sent_at = NOW(),
               attempt = attempt + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [rec.id]
        );

        console.log(
          `✅ Recordatorio ${rec.id} enviado a ${rec.email} (intento ${rec.attempt + 1}/${rec.max_attempts})`
        );
        enviados++;
      } catch (emailErr) {
        // Incrementar intento y marcar como FAILED si llega a max
        const nuevoIntento = rec.attempt + 1;
        const status =
          nuevoIntento >= rec.max_attempts ? "FAILED" : "PENDING";

        await db.query(
          `UPDATE recordatorios
           SET status = $1,
               attempt = attempt + 1,
               error_message = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [status, emailErr.message, rec.id]
        );

        console.error(
          `❌ Error enviando recordatorio ${rec.id}: ${emailErr.message}`
        );
        fallidos++;
      }
    }

    console.log(
      `📊 Resumen: ${enviados} enviados, ${fallidos} fallidos (total: ${recordatorios.length})`
    );
  } catch (err) {
    console.error("❌ Error en procesarRecordatoriosPendientes:", err);
  }
}

/**
 * Cancela recordatorios de documentos firmados
 */
async function cancelarRecordatoriosFirmados() {
  try {
    const canceladosRes = await db.query(
      `UPDATE recordatorios
       SET status = 'CANCELLED'
       WHERE status IN ('PENDING', 'SENT')
         AND documento_id IN (
           SELECT id FROM documentos
           WHERE estado = 'FIRMADO' OR estado = 'RECHAZADO'
         )
       RETURNING id`
    );

    if (canceladosRes.rowCount > 0) {
      console.log(
        `🛑 Cancelados ${canceladosRes.rowCount} recordatorios de documentos completados`
      );
    }
  } catch (err) {
    console.error("❌ Error cancelando recordatorios:", err);
  }
}

/**
 * Inicia el scheduler
 * Ejecuta cada hora a los 15 minutos
 */
function iniciarReminderScheduler() {
  // Cada hora a las :15 minutos
  cron.schedule("15 * * * *", async () => {
    console.log("▶️ Ejecutando cron de recordatorios...");
    await procesarRecordatoriosPendientes();
    await cancelarRecordatoriosFirmados();
  });

  console.log("✅ Reminder scheduler iniciado (cada hora a las :15)");
}

module.exports = { iniciarReminderScheduler };

