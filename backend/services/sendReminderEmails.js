// backend/services/sendReminderEmails.js
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
 * Envía un correo de recordatorio para firmar un documento.
 * @param {Object} documento - Documento pendiente.
 * @param {number|string} documento.id
 * @param {string} documento.nombre
 * @param {string} documento.signer_email
 */
async function sendReminderEmail(documento) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const mailOptions = {
    from: `"Firma Digital" <${process.env.REMITENTE || process.env.SMTP_USER}>`,
    to: documento.signer_email,
    subject: 'Recordatorio: Firma tu documento pendiente',
    html: `
      <h2>¡Hola!</h2>
      <p>El documento "${documento.nombre}" está esperando tu firma.</p>
      <p><a href="${frontendUrl}/firmar/${documento.id}">Firmar ahora</a></p>
      <p>Saludos,<br>Equipo Firma Digital</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de recordatorio enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando correo de recordatorio:', error);
    return false;
  }
}

module.exports = { sendReminderEmail };
