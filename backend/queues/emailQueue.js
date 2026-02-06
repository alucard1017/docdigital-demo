// backend/queues/emailQueue.js
const Queue = require('bull');
const nodemailer = require('nodemailer');

const redisUrl = process.env.REDIS_URL;

// Si no hay REDIS_URL, desactivamos la cola y usamos envío directo desde donde se llame.
if (!redisUrl) {
  console.warn('⚠️ [EMAIL QUEUE] REDIS_URL no definida. Cola de emails DESACTIVADA.');

  // Exportamos un "dummy queue" con un add que solo loguea.
  module.exports = {
    emailQueue: {
      add: async (data) => {
        console.log('⚠️ [EMAIL QUEUE] add() llamado pero la cola está desactivada. Datos:', data.to || data);
        // No hacemos nada más para evitar intentos de conexión a Redis.
      },
    },
  };

  return; // Salimos del módulo aquí.
}

// Si hay REDIS_URL, configuramos cola normalmente
console.log('✅ [EMAIL QUEUE] Inicializando cola de emails con Redis:', redisUrl);

const emailQueue = new Queue('emails', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

// Configurar transporter (Mailtrap / Brevo / lo que definas por env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
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
      from: process.env.SMTP_FROM || 'noreply@verifirma.com',
      to,
      subject,
      html,
    });
    console.log(`✅ [EMAIL QUEUE] Enviado a ${to} - MessageID: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [EMAIL QUEUE] Error enviando a ${to}:`, error.message);
    throw error;
  }
});

// Event listeners
emailQueue.on('completed', (job) => {
  console.log(`✅ [EMAIL QUEUE] Job #${job.id} completado`);
});

emailQueue.on('failed', (job, err) => {
  console.error(
    `❌ [EMAIL QUEUE] Job #${job.id} falló (intento ${job.attemptsMade}/3): ${err.message}`
  );
});

emailQueue.on('error', (err) => {
  console.error('❌ [EMAIL QUEUE] Error crítico:', err);
});

module.exports = { emailQueue };
