// backend/services/emailService.js
const nodemailer = require('nodemailer');

console.log('📬 [EMAIL] Cargando emailService.js');

// Variables SMTP (Render / .env)
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
} = process.env;

// Log de variables presentes (no muestra contraseñas)
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
  console.warn('⚠️ [EMAIL] Faltan variables SMTP:', {
    SMTP_HOST: !!SMTP_HOST,
    SMTP_PORT: !!SMTP_PORT,
    SMTP_USER: !!SMTP_USER,
    SMTP_PASS: !!SMTP_PASS,
    SMTP_FROM_EMAIL: !!SMTP_FROM_EMAIL,
  });
}

// Transporter único
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: Number(SMTP_PORT) || 2525,
  secure: Number(SMTP_PORT) === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Enviar email genérico
 */
async function sendEmail({ to, subject, html }) {
  const fromEmail = SMTP_FROM_EMAIL || 'noreply@verifirma.com';
  const fromName = SMTP_FROM_NAME || 'VeriFirma';

  try {
    console.log('📬 [EMAIL] Enviando email:', { to, subject });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log('✅ [EMAIL] Enviado OK:', info && info.messageId);
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Error enviando email:', error.message);
    return false;
  }
}

/**
 * Invitación a firmar
 */
async function sendSigningInvitation(email, docTitle, signUrl, signerName = '') {
  const subject = `Invitación a firmar: ${docTitle}`;

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
            <p>Hola ${signerName || ''}</p>
            <p>Has recibido una invitación para <strong>firmar</strong> el siguiente documento en <strong>VeriFirma</strong>:</p>
            <p style="font-size: 16px; font-weight: bold; color: #1e293b;">${docTitle}</p>
            <p>Haz clic en el botón siguiente para proceder con la firma electrónica:</p>
            <a href="${signUrl}" class="button">Ir a Firmar Documento</a>
            <p style="color: #666; font-size: 14px;">Este enlace es válido por 30 días.</p>
          </div>
          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Invitación a visar
 */
async function sendVisadoInvitation(email, docTitle, signUrl, visadorName = '') {
  const subject = `Invitación a visar: ${docTitle}`;

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
            <p>Hola ${visadorName || ''}</p>
            <p>Has recibido una invitación para <strong>visar</strong> el siguiente documento en <strong>VeriFirma</strong>:</p>
            <p style="font-size: 16px; font-weight: bold; color: #1e293b;">${docTitle}</p>
            <p>El visado valida el contenido y estado del documento.</p>
            <a href="${signUrl}" class="button">Ir a Visar Documento</a>
            <p style="color: #666; font-size: 14px;">Este enlace es válido por 30 días.</p>
          </div>
          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Notificación genérica HTML
 */
async function sendNotification(email, subject, html) {
  return sendEmail({ to: email, subject, html });
}

module.exports = {
  sendEmail,
  sendSigningInvitation,
  sendVisadoInvitation,
  sendNotification,
};
