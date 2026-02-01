// backend/services/sendSignatureInviteEmail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,              // live.smtp.mailtrap.io
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                            // usamos STARTTLS en 587
  auth: {
    user: process.env.SMTP_USER,            // apismtp@mailtrap.io
    pass: process.env.SMTP_PASS,            // tu API token
  },
});

/**
 * Envía una invitación al representante legal para firmar vía enlace con token.
 */
async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  sign_url,
}) {
  // Usa aquí el dominio verificado en Mailtrap, por ejemplo:
  const fromAddress = `"Firma Digital" <no-reply@demomailtrap.co>`;

  const mailOptions = {
    from: fromAddress,
    to: signer_email, // ahora sí al correo real del firmante
    subject: `Invitación a firmar: ${document_title}`,
    html: `
      <h2>Hola ${signer_name || ''}</h2>
      <p>Has sido invitado a firmar el documento <strong>"${document_title}"</strong>.</p>
      <p>Puedes revisarlo y firmarlo haciendo clic en el siguiente enlace:</p>
      <p><a href="${sign_url}">Firmar documento ahora</a></p>
      <p>Si no reconoces esta solicitud, puedes ignorar este correo.</p>
      <p>Saludos,<br>Equipo Firma Digital</p>
    `,
  };

  try {
    console.log('Enviando invitación de firma a:', signer_email);
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de invitación de firma enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando correo de invitación de firma:', error);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
