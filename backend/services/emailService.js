// backend/services/emailService.js
const { emailQueue } = require('../queues/emailQueue');
const nodemailer = require('nodemailer');

// Transporter directo (por si la cola está desactivada)
const directTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Encolar un email para envío asincrónico
 * Si la cola está desactivada (dummy), hace fallback a envío directo.
 */
async function queueEmail(to, subject, html) {
  try {
    if (emailQueue && typeof emailQueue.add === 'function' && emailQueue.add.name !== 'bound add') {
      const job = await emailQueue.add({ to, subject, html }, { delay: 0 });
      console.log(`📬 [EMAIL SERVICE] Email encolado para ${to} (Job #${job.id})`);
      return job;
    }

    console.log('⚠️ [EMAIL SERVICE] Cola de emails no disponible, enviando directo a', to);
    const result = await directTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@verifirma.com',
      to,
      subject,
      html,
    });
    console.log(`✅ [EMAIL SERVICE] Email enviado directo a ${to} - MessageID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error enviando email:', error.message);
    throw error;
  }
}

/**
 * Enviar invitación a firmar
 */
async function sendSigningInvitation(email, docTitle, signUrl) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { margin: 20px 0; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📄 Invitación a Firmar Documento</h2>
          </div>
          <div class="content">
            <p>¡Hola!</p>
            <p>Ha recibido una invitación para <strong>firmar</strong> el siguiente documento en <strong>VeriFirma</strong>:</p>
            <p style="font-size: 16px; font-weight: bold; color: #1e293b;">${docTitle}</p>
            <p>Haga clic en el botón siguiente para proceder con la firma electrónica:</p>
            <a href="${signUrl}" class="button">Ir a Firmar Documento</a>
            <p style="color: #666; font-size: 14px;">Este enlace es válido por 30 días.</p>
          </div>
          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no responda.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return queueEmail(email, `Invitación a firmar: ${docTitle}`, html);
}

/**
 * Enviar invitación a visar
 */
async function sendVisadoInvitation(email, docTitle, signUrl) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { margin: 20px 0; }
          .button { display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✓ Invitación a Visar Documento</h2>
          </div>
          <div class="content">
            <p>¡Hola!</p>
            <p>Ha recibido una invitación para <strong>visar</strong> el siguiente documento en <strong>VeriFirma</strong>:</p>
            <p style="font-size: 16px; font-weight: bold; color: #1e293b;">${docTitle}</p>
            <p>El visado es un acto formal que valida el contenido y estado del documento.</p>
            <a href="${signUrl}" class="button">Ir a Visar Documento</a>
            <p style="color: #666; font-size: 14px;">Este enlace es válido por 30 días.</p>
          </div>
          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no responda.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return queueEmail(email, `Invitación a visar: ${docTitle}`, html);
}

/**
 * Enviar notificación genérica
 */
async function sendNotification(email, subject, html) {
  return queueEmail(email, subject, html);
}

module.exports = {
  queueEmail,
  sendSigningInvitation,
  sendVisadoInvitation,
  sendNotification,
};
