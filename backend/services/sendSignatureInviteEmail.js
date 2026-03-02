// backend/services/sendSignatureInviteEmail.js
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
require("dotenv").config();

console.log("DEBUG EMAIL >> Cargando sendSignatureInviteEmail.js");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
  SIGN_BASE_URL,        // ej: https://firmar.verifirma.cl
  VERIFICATION_BASE_URL // ej: https://verificar.verifirma.cl
} = process.env;

if (
  !SMTP_HOST ||
  !SMTP_PORT ||
  !SMTP_USER ||
  !SMTP_PASS ||
  !SMTP_FROM_EMAIL
) {
  console.warn("DEBUG EMAIL >> Faltan variables SMTP:", {
    SMTP_HOST: !!SMTP_HOST,
    SMTP_PORT: !!SMTP_PORT,
    SMTP_USER: !!SMTP_USER,
    SMTP_PASS: !!SMTP_PASS,
    SMTP_FROM_EMAIL: !!SMTP_FROM_EMAIL,
  });
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false, // con 587 se usa STARTTLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Genera data URL con QR apuntando a "url"
 */
async function generateQrDataUrl(url) {
  if (!url) return "";
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });
    return dataUrl;
  } catch (err) {
    console.error("DEBUG EMAIL >> error generando QR:", err.message);
    return "";
  }
}

/**
 * Enviar invitación de firma por SMTP (Nodemailer)
 * Incluye código de verificación + QR opcional
 */
async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  signature_token,     // token para firma pública
  verification_code,   // ej: VF-2026-000008
}) {
  const fromEmail = SMTP_FROM_EMAIL;
  const fromName = SMTP_FROM_NAME || "VeriFirma";

  // Construir URLs limpias usando los dominios de firma/verificación
  const signBase = SIGN_BASE_URL || "";              // https://firmar.verifirma.cl
  const verifyBase = VERIFICATION_BASE_URL || "";    // https://verificar.verifirma.cl

  const signUrl =
    signBase && signature_token
      ? `${signBase}/?token=${encodeURIComponent(signature_token)}`
      : "";

  const publicVerifyUrl =
    verifyBase && verification_code
      ? `${verifyBase}/?code=${encodeURIComponent(verification_code)}`
      : "";

  const subject = `Invitación a firmar: ${document_title}`;

  // QR apuntando preferentemente a la URL de firma
  const qrTargetUrl = signUrl || publicVerifyUrl;
  const qrDataUrl = await generateQrDataUrl(qrTargetUrl);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Invitación a firmar documento</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a0d;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px -24px rgba(15,23,42,0.45);">
          <!-- Header -->
          <tr>
            <td style="padding:16px 24px 8px;border-bottom:1px solid #e5e7eb;text-align:left;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://verifirma.cl/favicon-32x32.png" alt="VeriFirma" width="28" height="28" style="border-radius:6px;display:block;" />
                  </td>
                  <td style="padding-left:10px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;font-weight:700;">
                    VeriFirma · Firma electrónica
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">
                Invitación a firmar documento
              </h1>

              <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#4b5563;">
                Hola <strong>${signer_name || ""}</strong>,
              </p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563;">
                Has sido invitado a revisar y firmar electrónicamente el siguiente documento en <strong>VeriFirma</strong>:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;font-size:13px;border-radius:12px;background-color:#f9fafb;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:10px 14px;width:40%;color:#6b7280;">Título del documento</td>
                  <td style="padding:10px 14px;font-weight:600;">${document_title}</td>
                </tr>
                ${
                  verification_code
                    ? `
                <tr>
                  <td style="padding:10px 14px;color:#6b7280;">Código de verificación</td>
                  <td style="padding:10px 14px;font-weight:600;">${verification_code}</td>
                </tr>`
                    : ""
                }
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
                Para revisar el contenido y firmar el documento, haz clic en el siguiente botón:
              </p>

              ${
                signUrl
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 20px;">
                <tr>
                  <td align="center">
                    <a href="${signUrl}" style="display:inline-block;padding:10px 22px;border-radius:999px;background-color:#1d4ed8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Firmar documento
                    </a>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6b7280;">
                En cualquier momento, puedes verificar la autenticidad de este documento utilizando su código de verificación en el portal público:
              </p>

              ${
                publicVerifyUrl && verification_code
                  ? `
              <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#111827;">
                <strong>Portal de verificación:</strong><br />
                <a href="${publicVerifyUrl}" style="color:#1d4ed8;text-decoration:none;">${publicVerifyUrl}</a>
              </p>`
                  : ""
              }

              ${
                qrDataUrl
                  ? `
              <div style="margin-top:16px;text-align:center;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
                  También puedes escanear este código QR para acceder rápidamente:
                </div>
                <div style="display:inline-block;padding:6px;border-radius:12px;background:#111827;">
                  <img src="${qrDataUrl}" alt="QR de acceso al documento" style="display:block;width:144px;height:144px;" />
                </div>
              </div>`
                  : ""
              }

              <p style="margin:16px 0 8px;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si no reconoces esta solicitud o crees que se trata de un error, puedes ignorar este correo.
                No se realizará ninguna firma sin tu confirmación explícita.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:12px 24px 16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
              VeriFirma · Plataforma de firma electrónica<br />
              <a href="https://verifirma.cl" style="color:#9ca3af;text-decoration:none;">https://verifirma.cl</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    console.log("DEBUG EMAIL >> preparando envío", {
      to: signer_email,
      subject,
      signUrl,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: signer_email,
      subject,
      html,
    });

    console.log(
      "DEBUG EMAIL >> enviado OK, messageId:",
      info && info.messageId
    );
    return true;
  } catch (error) {
    console.error("DEBUG EMAIL >> error enviando correo:", error.message);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
