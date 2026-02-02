const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // con 587 se usa STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  sign_url,
}) {
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || 'Firma Digital';

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
    console.log('DEBUG EMAIL >> to:', signer_email, 'title:', document_title);

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: signer_email,
      subject,
      html,
    });

    console.log('Correo enviado via SMTP Mailtrap:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando correo via SMTP Mailtrap:', error);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
