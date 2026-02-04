const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('DEBUG EMAIL >> Cargando sendSignatureInviteEmail.js');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
  console.warn('DEBUG EMAIL >> Faltan variables SMTP:', {
    SMTP_HOST: !!SMTP_HOST,
    SMTP_PORT: !!SMTP_PORT,
    SMTP_USER: !!SMTP_USER,
    SMTP_PASS: !!SMTP_PASS,
    SMTP_FROM_EMAIL: !!SMTP_FROM_EMAIL,
  });
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false, // con 587 se usa STARTTLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  sign_url,
}) {
  const fromEmail = SMTP_FROM_EMAIL;
  const fromName = SMTP_FROM_NAME || 'Firma Digital';

  const subject = `Invitación a firmar: ${document_title}`;

  const html = `
    <h2>Hola ${signer_name || ''}</h2>
    <p>Has sido invitado a firmar el documento <strong>"${document_title}"</strong>.</p>
    <p>Puedes revisarlo y firmarlo haciendo clic en el siguiente enlace:</p>
    <p><a href="${sign_url}">Firmar documento ahora</a></p>
    <p>Si no reconoces esta solicitud, puedes ignorar este correo.</p>
    <p>Saludos,<br>Equipo Firma Digital</p>
  `;

  try {
    console.log('DEBUG EMAIL >> preparando envío', {
      to: signer_email,
      subject,
      sign_url,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: signer_email,
      subject,
      html,
    });

    console.log('DEBUG EMAIL >> enviado OK, messageId:', info && info.messageId);
    return true;
  } catch (error) {
    console.error('DEBUG EMAIL >> error enviando correo:', error.message);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
