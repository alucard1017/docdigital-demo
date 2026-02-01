// backend/services/sendSignatureInviteEmail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envía una invitación al representante legal para firmar vía enlace con token.
 * @param {Object} params
 * @param {string} params.signer_email - Correo del representante.
 * @param {string} params.signer_name  - Nombre completo del representante.
 * @param {string} params.document_title - Título del documento.
 * @param {string} params.sign_url - URL completa con ?token=...
 */
async function sendSignatureInviteEmail({ signer_email, signer_name, document_title, sign_url }) {
  const fromAddress = `"Firma Digital" <${process.env.REMITENTE || process.env.SMTP_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: chuquid2000@gmail.com,
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
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de invitación de firma enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando correo de invitación de firma:', error);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
