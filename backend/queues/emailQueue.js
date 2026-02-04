// backend/queues/emailQueue.js
const Queue = require("bull");
const nodemailer = require("nodemailer");

// Crear la cola de emails con Redis
const emailQueue = new Queue("emails", {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3, // Reintentar 3 veces
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s entre reintentos
    },
    removeOnComplete: true,
  },
});

// Configurar transporter de Mailtrap
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

// Procesar jobs de email
emailQueue.process(async (job) => {
  const { to, subject, html } = job.data;

  try {
    console.log(`📧 [EMAIL QUEUE] Enviando a: ${to}`);
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@docdigital.com",
      to,
      subject,
      html,
    });
    console.log(`✅ [EMAIL QUEUE] Enviado a ${to} - MessageID: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [EMAIL QUEUE] Error enviando a ${to}:`, error.message);
    throw error; // Bull reintenta automáticamente
  }
});

// Event listeners
emailQueue.on("completed", (job) => {
  console.log(`✅ [EMAIL QUEUE] Job #${job.id} completado`);
});

emailQueue.on("failed", (job, err) => {
  console.error(
    `❌ [EMAIL QUEUE] Job #${job.id} falló (intento ${job.attemptsMade}/3): ${err.message}`
  );
});

emailQueue.on("error", (err) => {
  console.error("❌ [EMAIL QUEUE] Error crítico:", err);
});

module.exports = { emailQueue };
