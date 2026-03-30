// backend/jobs/reminderScheduler.js
const cron = require("node-cron");
const db = require("../db");
const { sendSigningInvitation } = require("../services/emailService");

const FRONT_BASE_URL =
  process.env.FRONTEND_URL || "https://docdigital-demo.onrender.com";

function buildPublicSignUrl(token) {
  return `${FRONT_BASE_URL}/firma-publica?token=${token}`;
}

async function markReminderAsFailed(reminderId, message) {
  await db.query(
    `
    UPDATE recordatorios
    SET
      estado = 'fallido',
      status = 'FAILED',
      intentos = COALESCE(intentos, attempt, 0) + 1,
      attempt = COALESCE(attempt, intentos, 0) + 1,
      error_message = $2,
      updated_at = NOW()
    WHERE id = $1
    `,
    [reminderId, message]
  );
}

async function markReminderAsProcessed(reminderId) {
  await db.query(
    `
    UPDATE recordatorios
    SET
      estado = 'enviado',
      status = 'SENT',
      sent_at = NOW(),
      intentos = COALESCE(intentos, attempt, 0) + 1,
      attempt = COALESCE(attempt, intentos, 0) + 1,
      updated_at = NOW()
    WHERE id = $1
    `,
    [reminderId]
  );
}

async function markReminderRetry(reminderId, nextState, errorMessage) {
  const legacyStatusMap = {
    pendiente: "PENDING",
    enviado: "SENT",
    fallido: "FAILED",
    cancelado: "CANCELLED",
  };

  await db.query(
    `
    UPDATE recordatorios
    SET
      estado = $1,
      status = $2,
      intentos = COALESCE(intentos, attempt, 0) + 1,
      attempt = COALESCE(attempt, intentos, 0) + 1,
      error_message = $3,
      updated_at = NOW()
    WHERE id = $4
    `,
    [nextState, legacyStatusMap[nextState] || "PENDING", errorMessage, reminderId]
  );
}

/**
 * Procesa recordatorios pendientes:
 * - Busca recordatorios cuyo próximo intento ya venció
 * - Resuelve token de firma del firmante
 * - Envía email si encuentra token
 * - Actualiza estados e intentos en esquema nuevo + legacy
 */
async function procesarRecordatoriosPendientes() {
  try {
    console.log("⏰ Iniciando procesamiento de recordatorios pendientes...");

    const recordatoriosRes = await db.query(
      `
      SELECT
        r.id,
        r.documento_id,
        r.firmante_id,
        COALESCE(r.destinatario_email, r.email) AS email_destino,
        COALESCE(r.intentos, r.attempt, 0) AS intentos_actuales,
        COALESCE(r.max_intentos, r.max_attempts, 3) AS max_intentos_actuales,
        COALESCE(r.estado, LOWER(r.status), 'pendiente') AS estado_actual,
        COALESCE(r.proximo_intento_at, r.scheduled_at) AS fecha_programada,
        d.title,
        ds.sign_token AS token_firmante
      FROM recordatorios r
      JOIN documents d
        ON d.id = r.documento_id
      LEFT JOIN document_signers ds
        ON ds.document_id = d.id
       AND LOWER(ds.email) = LOWER(COALESCE(r.destinatario_email, r.email))
      WHERE COALESCE(r.estado, LOWER(r.status), 'pendiente') = 'pendiente'
        AND COALESCE(r.proximo_intento_at, r.scheduled_at) <= NOW()
        AND COALESCE(r.intentos, r.attempt, 0) < COALESCE(r.max_intentos, r.max_attempts, 3)
      ORDER BY COALESCE(r.proximo_intento_at, r.scheduled_at) ASC
      LIMIT 100
      `
    );

    const recordatorios = recordatoriosRes.rows;
    console.log(`📬 Encontrados ${recordatorios.length} recordatorios para procesar`);

    let enviados = 0;
    let fallidos = 0;

    for (const rec of recordatorios) {
      try {
        if (!rec.token_firmante) {
          console.warn(
            `⚠️ Recordatorio ${rec.id} sin token_firmante; se marca como fallido`
          );

          await markReminderAsFailed(
            rec.id,
            "Token de firma no encontrado para este firmante"
          );

          fallidos++;
          continue;
        }

        const url = buildPublicSignUrl(rec.token_firmante);

        await sendSigningInvitation(
          rec.email_destino,
          rec.title,
          url,
          rec.email_destino.split("@")[0]
        );

        await markReminderAsProcessed(rec.id);

        console.log(
          `✅ Recordatorio ${rec.id} enviado a ${rec.email_destino} (intento ${
            rec.intentos_actuales + 1
          }/${rec.max_intentos_actuales})`
        );

        enviados++;
      } catch (emailErr) {
        const nuevoIntento = rec.intentos_actuales + 1;
        const nextState =
          nuevoIntento >= rec.max_intentos_actuales ? "fallido" : "pendiente";

        await markReminderRetry(rec.id, nextState, emailErr.message);

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
 * Cancela recordatorios de documentos completados
 */
async function cancelarRecordatoriosFirmados() {
  try {
    const canceladosRes = await db.query(
      `
      UPDATE recordatorios
      SET
        estado = 'cancelado',
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE COALESCE(estado, LOWER(status), 'pendiente') IN ('pendiente', 'enviado')
        AND documento_id IN (
          SELECT id
          FROM documents
          WHERE COALESCE(status, estado) IN ('FIRMADO', 'RECHAZADO', 'COMPLETADO')
        )
      RETURNING id
      `
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

function iniciarReminderScheduler() {
  cron.schedule("15 * * * *", async () => {
    console.log("▶️ Ejecutando cron de recordatorios...");
    await procesarRecordatoriosPendientes();
    await cancelarRecordatoriosFirmados();
  });

  console.log("✅ Reminder scheduler iniciado (cada hora a las :15)");
}

module.exports = { iniciarReminderScheduler };