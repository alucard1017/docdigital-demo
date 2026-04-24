// backend/services/sendReminderEmails.js
const { sendSignatureInviteEmail } = require("./sendSignatureInviteEmail");

/**
 * sendReminderEmail
 *
 * Uso pensado para scripts / pruebas simples.
 * Recibe un objeto documento con al menos:
 * - id
 * - signer_email
 * - signer_name (opcional)
 * - title / nombre (alguno de los dos)
 * - sign_token (opcional, para URL directa)
 * - verification_code (opcional)
 * - customMessage (opcional)
 */
async function sendReminderEmail(documento) {
  if (!documento || !documento.signer_email) {
    console.error(
      "📧 [REMINDER] Documento o signer_email no válido en sendReminderEmail"
    );
    return false;
  }

  const safeTitle =
    documento.title ||
    documento.nombre ||
    documento.document_title ||
    "Documento";

  const payload = {
    signer_email: documento.signer_email,
    signer_name: documento.signer_name || documento.firmante_nombre || "",
    document_title: safeTitle,
    signature_token:
      documento.sign_token ||
      documento.signature_token ||
      documento.token_firma ||
      null,
    verification_code:
      documento.verification_code ||
      documento.codigo_verificacion ||
      null,
    options: {
      reminder: true,
      customMessage:
        typeof documento.customMessage === "string"
          ? documento.customMessage
          : null,
    },
  };

  try {
    const ok = await sendSignatureInviteEmail(payload);
    if (!ok) {
      console.error(
        "📧 [REMINDER] Error al enviar recordatorio con sendSignatureInviteEmail"
      );
    }
    return ok;
  } catch (err) {
    console.error("📧 [REMINDER] Excepción al enviar recordatorio:", err);
    return false;
  }
}

module.exports = { sendReminderEmail };