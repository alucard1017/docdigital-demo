// backend/queues/emailQueue.js
const Queue = require("bull");
const nodemailer = require("nodemailer");

const ENABLE_EMAIL_QUEUE =
  String(process.env.ENABLE_EMAIL_QUEUE || "true").toLowerCase() === "true";

const redisUrl = process.env.REDIS_URL;

if (!ENABLE_EMAIL_QUEUE) {
  console.warn("ℹ️ [EMAIL QUEUE] Cola de emails deshabilitada (ENABLE_EMAIL_QUEUE=false)");

  module.exports = {
    emailQueue: {
      add: async (data) => {
        console.log(
          "ℹ️ [EMAIL QUEUE] add() llamado pero la cola está deshabilitada.",
          data.to || data
        );
      },
    },
  };

  return;
}

if (!redisUrl) {
  console.warn(
    "⚠️ [EMAIL QUEUE] REDIS_URL no definida. Cola de emails DESACTIVADA."
  );

  module.exports = {
    emailQueue: {
      add: async (data) => {
        console.log(
          "⚠️ [EMAIL QUEUE] add() llamado pero la cola está desactivada (sin REDIS_URL). Datos:",
          data.to || data
        );
      },
    },
  };

  return;
}

console.log("✅ [EMAIL QUEUE] Inicializando cola de emails con Redis:", redisUrl);

const emailQueue = new Queue("emails", redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Configurar transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
  port: Number(process.env.SMTP_PORT || 2525),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT || 5000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 5000),
});

emailQueue.process(async (job) => {
  const { to, subject, html } = job.data;

  try {
    console.log(`📧 [EMAIL QUEUE] Enviando a: ${to}`);
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || "noreply@verifirma.com",
      to,
      subject,
      html,
    });
    console.log(
      `✅ [EMAIL QUEUE] Enviado a ${to} - MessageID: ${result.messageId}`
    );
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(
      `❌ [EMAIL QUEUE] Error enviando a ${to}:`,
      error.message
    );
    throw error;
  }
});

emailQueue.on("completed", (job) => {
  console.log(`✅ [EMAIL QUEUE] Job #${job.id} completado`);
});

emailQueue.on("failed", (job, err) => {
  console.error(
    `❌ [EMAIL QUEUE] Job #${job.id} falló (intento ${job.attemptsMade}/3): ${err.message}`
  );
});

emailQueue.on("error", (err) => {
  console.error("❌ [EMAIL QUEUE] Error crítico en cola:", err.message);
});

module.exports = { emailQueue };