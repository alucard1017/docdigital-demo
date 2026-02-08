const { sendEmail } = require('./emailService');

async function sendReminderEmail(documento) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const html = `
    <h2>¡Hola!</h2>
    <p>El documento "${documento.nombre}" está esperando tu firma.</p>
    <p><a href="${frontendUrl}/firmar/${documento.id}">Firmar ahora</a></p>
    <p>Saludos,<br>Equipo VeriFirma</p>
  `;

  return sendEmail({
    to: documento.signer_email,
    subject: 'Recordatorio: Firma tu documento pendiente',
    html,
  });
}

module.exports = { sendReminderEmail };
