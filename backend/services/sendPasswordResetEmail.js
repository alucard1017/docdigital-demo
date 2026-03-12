// backend/services/sendPasswordResetEmail.js
const { sendEmail } = require("./sendEmailGeneric"); // o tu servicio SMTP existente

async function sendPasswordResetAdminEmail({ to, name, tempPassword }) {
  if (!to) {
    return false;
  }

  const subject = "Tu nueva contraseña temporal - VeriFirma";
  const html = `
    <p>Hola ${name || ""},</p>
    <p>Un administrador ha reseteado tu contraseña en <strong>VeriFirma</strong>.</p>
    <p>Tu nueva contraseña temporal es:</p>
    <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">
      ${tempPassword}
    </p>
    <p>Por seguridad, inicia sesión lo antes posible y cámbiala desde tu perfil.</p>
    <p>Si no reconoces este cambio, contacta al soporte de VeriFirma.</p>
  `;

  return sendEmail({
    to,
    subject,
    html,
  });
}

module.exports = { sendPasswordResetAdminEmail };
