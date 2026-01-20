const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true solo si usas puerto 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendReminderEmail(documento) {
  const mailOptions = {
    from: `"Firma Digital" <${process.env.REMITENTE}>`,
    to: documento.signer_email,
    subject: 'Recordatorio: Firma tu documento pendiente',
    html: `
      <h2>¡Hola!</h2>
      <p>El documento "${documento.nombre}" está esperando tu firma.</p>
      <p><a href="${process.env.FRONTEND_URL}/firmar/${documento.id}">Firmar ahora</a></p>
      <p>Saludos,<br>Equipo Firma Digital</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando correo:', error);
    return false;
  }
}

module.exports = { sendReminderEmail };
