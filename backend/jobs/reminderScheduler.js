// backend/jobs/reminderScheduler.js
const cron = require("node-cron");
const db = require("../db");
const { sendSigningInvitation } = require("../services/emailService");

const FRONT_BASE_URL =
  process.env.FRONTEND_URL || "https://docdigital-demo.onrender.com";

function buildPublicSignUrl(token) {
  return `${FRONT_BASE_URL}/firma-publica?token=${token}`;
}

/**
 * Procesa recordatorios pendientes:
 * - Busca recordatorios con scheduled_at <= NOW()
 * - Usa el signer real (document_signers) para obtener el sign_token
 * - Intenta enviar email
 * - Actualiza status y attempt
 */
async function procesarRecordatoriosPendientes() {
  try {
    console.log("⏰ Iniciando procesamiento de recordatorios pendientes...");

    const recordatoriosRes = await db.query(
      `
      SELECT 
        r.id,
        r.documento_id,          -- referencia al documento original (tabla documentos)
        r.firmante_id,           -- id del firmante en tabla firmantes (modelo viejo)
        r.email,
        r.attempt,
        r.max_attempts,
        r.status,
        d.titulo,
        ds.sign_token AS token_firmante
      FROM recordatorios r
      JOIN documentos d ON d.id = r.documento_id
      LEFT JOIN firmantes f ON f.id = r.firmante_id
      LEFT JOIN documents nd
        ON nd.nuevo_documento_id = d.id
      LEFT JOIN document_signers ds
        ON ds.document_id = nd.id
       AND ds.email = r.email
      WHERE r.status = 'PENDING'
        AND r.scheduled_at <= NOW()
        AND r.attempt < r.max_attempts
      ORDER BY r.scheduled_at ASC
      LIMIT 100
      `
    );

    const recordatorios = recordatoriosRes.rows;
    console.log(
      `📬 Encontrados ${recordatorios.length} recordatorios para procesar`
    );

    let enviados = 0;
    let fallidos = 0;

    for (const rec of recordatorios) {
      try {
        // Preferir token del modelo nuevo; si no existe, no enviamos
        if (!rec.token_firmante) {
          console.warn(
            `⚠️ Recordatorio ${rec.id} sin token_firmante (sign_token); se marca como FAILED`
          );

          await db.query(
            `
            UPDATE recordatorios
            SET status = 'FAILED',
                attempt = attempt + 1,
                error_message = 'Token de firma no encontrado para este firmante',
                updated_at = NOW()
            WHERE id = $1
            `,
            [rec.id]
          );
          fallidos++;
          continue;
        }

        const url = buildPublicSignUrl(rec.token_firmante);

        await sendSigningInvitation(
          rec.email,
          rec.titulo,
          url,
          rec.email.split("@")[0]
        );

        await db.query(
          `
          UPDATE recordatorios
          SET status = 'SENT',
              sent_at = NOW(),
              attempt = attempt + 1,
              updated_at = NOW()
          WHERE id = $1
          `,
          [rec.id]
        );

        console.log(
          `✅ Recordatorio ${rec.id} enviado a ${rec.email} (intento ${
            rec.attempt + 1
          }/${rec.max_attempts})`
        );
        enviados++;
      } catch (emailErr) {
        const nuevoIntento = rec.attempt + 1;
        const status =
          nuevoIntento >= rec.max_attempts ? "FAILED" : "PENDING";

        await db.query(
          `
          UPDATE recordatorios
          SET status = $1,
              attempt = attempt + 1,
              error_message = $2,
              updated_at = NOW()
          WHERE id = $3
          `,
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
 * Cancela recordatorios de documentos firmados o rechazados
 * (usa la tabla documentos porque recordatorios.documento_id apunta allí)
 */
async function cancelarRecordatoriosFirmados() {
  try {
    const canceladosRes = await db.query(
      `
      UPDATE recordatorios
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE status IN ('PENDING', 'SENT')
        AND documento_id IN (
          SELECT id FROM documentos
          WHERE estado IN ('FIRMADO', 'RECHAZADO')
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

/**
 * Inicia el scheduler (cada hora a los :15)
 */
function iniciarReminderScheduler() {
  cron.schedule("15 * * * *", async () => {
    console.log("▶️ Ejecutando cron de recordatorios...");
    await procesarRecordatoriosPendientes();
    await cancelarRecordatoriosFirmados();
  });

  console.log("✅ Reminder scheduler iniciado (cada hora a las :15)");
}

module.exports = { iniciarReminderScheduler };