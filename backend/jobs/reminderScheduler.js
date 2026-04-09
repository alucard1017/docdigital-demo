// backend/jobs/reminderScheduler.js
const cron = require("node-cron");
const {
  enviarRecordatoriosAutomaticos,
} = require("../services/reminderService");

const REMINDER_CRON = process.env.REMINDER_CRON || "15 * * * *";
const REMINDER_TIMEZONE = process.env.TZ || "America/Bogota";
const RUN_ON_START = process.env.REMINDER_RUN_ON_START === "true";
const ENABLE_REMINDER_SCHEDULER =
  String(process.env.ENABLE_REMINDER_SCHEDULER || "true")
    .toLowerCase() === "true";

let isRunning = false;
let lastRunAt = null;
let lastFinishAt = null;
let lastDurationMs = null;
let lastStatus = "idle";
let lastError = null;

async function ejecutarRecordatorios({ source = "cron" } = {}) {
  if (!ENABLE_REMINDER_SCHEDULER) {
    console.log(
      `ℹ️ Reminder scheduler deshabilitado (ENABLE_REMINDER_SCHEDULER=false, source=${source})`
    );
    return {
      ok: false,
      skipped: true,
      reason: "scheduler_disabled",
    };
  }

  if (isRunning) {
    console.log(
      `⏭️ Reminder scheduler omitido: ya hay una ejecución en curso (source=${source})`
    );
    return {
      ok: false,
      skipped: true,
      reason: "already_running",
    };
  }

  isRunning = true;
  lastRunAt = new Date().toISOString();
  lastStatus = "running";
  lastError = null;

  const startedAt = Date.now();

  try {
    console.log(
      `▶️ Ejecutando recordatorios automáticos (source=${source}, cron="${REMINDER_CRON}", tz="${REMINDER_TIMEZONE}")`
    );

    const result = await enviarRecordatoriosAutomaticos();

    lastFinishAt = new Date().toISOString();
    lastDurationMs = Date.now() - startedAt;
    lastStatus = "success";

    console.log(
      `✅ Reminder scheduler finalizado en ${lastDurationMs} ms`
    );

    return {
      ok: true,
      skipped: false,
      durationMs: lastDurationMs,
      result,
    };
  } catch (err) {
    lastFinishAt = new Date().toISOString();
    lastDurationMs = Date.now() - startedAt;
    lastStatus = "failed";
    lastError = err?.message || String(err);

    console.error("❌ Error en reminder scheduler:", err);

    return {
      ok: false,
      skipped: false,
      durationMs: lastDurationMs,
      error: lastError,
    };
  } finally {
    isRunning = false;
  }
}

function getReminderSchedulerStatus() {
  return {
    cron: REMINDER_CRON,
    timezone: REMINDER_TIMEZONE,
    isRunning,
    lastRunAt,
    lastFinishAt,
    lastDurationMs,
    lastStatus,
    lastError,
    enabled: ENABLE_REMINDER_SCHEDULER,
  };
}

function iniciarReminderScheduler() {
  if (!ENABLE_REMINDER_SCHEDULER) {
    console.log(
      "ℹ️ Reminder scheduler deshabilitado. No se registrará ningún cron (ENABLE_REMINDER_SCHEDULER=false)"
    );
    return;
  }

  if (!cron.validate(REMINDER_CRON)) {
    throw new Error(
      `Expresión CRON inválida para reminder scheduler: ${REMINDER_CRON}`
    );
  }

  cron.schedule(
    REMINDER_CRON,
    async () => {
      await ejecutarRecordatorios({ source: "cron" });
    },
    {
      timezone: REMINDER_TIMEZONE,
    }
  );

  console.log(
    `✅ Reminder scheduler iniciado (cron="${REMINDER_CRON}", tz="${REMINDER_TIMEZONE}")`
  );

  if (RUN_ON_START) {
    setTimeout(() => {
      ejecutarRecordatorios({ source: "startup" }).catch((err) => {
        console.error(
          "❌ Error en ejecución inicial del reminder scheduler:",
          err
        );
      });
    }, 5000);
  }
}

module.exports = {
  iniciarReminderScheduler,
  ejecutarRecordatorios,
  getReminderSchedulerStatus,
};