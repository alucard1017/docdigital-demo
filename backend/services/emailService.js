// backend/services/emailService.js
const nodemailer = require('nodemailer');

function createTransportForClient(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_port === 465,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.smtp_pass,
    },
  });
}

async function sendReminderEmail(documento, clientEmailConfig) {
  const transporter = createTransportForClient(clientEmailConfig);

  const mailOptions = {
    from: `"Firma Digital" <${clientEmailConfig.remitente || clientEmailConfig.smtp_user}>`,
    to: documento.signer_email,
    subject: 'Recordatorio: Firma tu documento pendiente',
    html: `
      <h2>¡Hola!</h2>
      <p>El documento "${documento.nombre}" está esperando tu firma.</p>
      <p><a href="${clientEmailConfig.frontend_url}/firmar/${documento.id}">Firmar ahora</a></p>
      <p>Saludos,<br>Equipo Firma Digital</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { createTransportForClient, sendReminderEmail };
