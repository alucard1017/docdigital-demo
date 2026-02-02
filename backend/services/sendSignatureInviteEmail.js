// backend/services/sendSignatureInviteEmail.js
const fetch = require('node-fetch');
require('dotenv').config();

const MAILTRAP_API_URL = 'https://send.api.mailtrap.io/api/send';

async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  sign_url,
}) {
  console.log('DEBUG EMAIL >> to:', signer_email, 'title:', document_title);

  const fromEmail = process.env.MAILTRAP_SENDER_EMAIL;
  const fromName = process.env.MAILTRAP_SENDER_NAME || 'Firma Digital';

  const subject = `Invitación a firmar: ${document_title}`;

  const html = `
    <h2>Hola ${signer_name || ''}</h2>
    <p>Has sido invitado a firmar el documento <strong>"${document_title}"</strong>.</p>
    <p>Puedes revisarlo y firmarlo haciendo clic en el siguiente enlace:</p>
    <p><a href="${sign_url}">Firmar documento ahora</a></p>
    <p>Si no reconoces esta solicitud, puedes ignorar este correo.</p>
    <p>Saludos,<br>Equipo Firma Digital</p>
  `;

  const payload = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [
      {
        email: signer_email,
        name: signer_name || '',
      },
    ],
    subject,
    html,
  };

  try {
    console.log('Enviando invitación de firma (Email API) a:', signer_email);

    const response = await fetch(MAILTRAP_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error Mailtrap API:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('Correo de invitación enviado via Mailtrap API:', data.message_ids || data);
    return true;
  } catch (error) {
    console.error('Error llamando a Mailtrap Email API:', error);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
