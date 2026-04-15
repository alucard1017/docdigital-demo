// backend/services/sendSignatureInviteEmail.js
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

console.log("📧 Cargando sendSignatureInviteEmail.js");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
  FRONTEND_URL,          // ej: https://docdigital.vercel.app
  PUBLIC_VERIFY_BASE_URL // ej: https://docdigital.vercel.app/verificar
} = process.env;

/* =========================
   Validación de configuración
   ========================= */

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
  console.warn("📧 [EMAIL] Faltan variables SMTP:", {
    SMTP_HOST: !!SMTP_HOST,
    SMTP_PORT: !!SMTP_PORT,
    SMTP_USER: !!SMTP_USER,
    SMTP_PASS: !!SMTP_PASS,
    SMTP_FROM_EMAIL: !!SMTP_FROM_EMAIL,
  });
}

if (!FRONTEND_URL || !PUBLIC_VERIFY_BASE_URL) {
  console.warn("📧 [EMAIL] Faltan URLs de frontend:", {
    FRONTEND_URL: !!FRONTEND_URL,
    PUBLIC_VERIFY_BASE_URL: !!PUBLIC_VERIFY_BASE_URL,
  });
}

/* =========================
   Transporter SMTP
   ========================= */

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false, // con 587 se usa STARTTLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/* =========================
   Helpers
   ========================= */

function normalizeBaseUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

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
    console.error("📧 [EMAIL] Error generando QR:", err.message);
    return "";
  }
}

/* =========================
   Servicio principal
   ========================= */

/**
 * Enviar invitación de firma por SMTP (Nodemailer)
 * Incluye:
 * - Enlace directo de firma pública (/public/sign?token=sign_token)
 * - Enlace de verificación por código (/verificar?code=...)
 * - QR apuntando al mejor enlace disponible
 */
async function sendSignatureInviteEmail({
  signer_email,
  signer_name,
  document_title,
  signature_token,   // token para firma pública (sign_token)
  verification_code, // ej: VF-2026-000008
}) {
  const fromEmail = SMTP_FROM_EMAIL;
  const fromName = SMTP_FROM_NAME || "VeriFirma";

  if (!signer_email) {
    console.error("📧 [EMAIL] signer_email requerido");
    return false;
  }

  const frontendBase = normalizeBaseUrl(FRONTEND_URL);
  const verifyBase = normalizeBaseUrl(PUBLIC_VERIFY_BASE_URL || "");

  // URL pública de firma: usa el portal principal + /public/sign
  // ej: https://docdigital.vercel.app/public/sign?token=...
  const signUrl =
    frontendBase && signature_token
      ? `${frontendBase}/public/sign?token=${encodeURIComponent(
          signature_token
        )}`
      : "";

  // URL pública de verificación por código
  // ej: https://docdigital.vercel.app/verificar?code=VF-2026-000008
  const publicVerifyUrl =
    verifyBase && verification_code
      ? `${verifyBase}?code=${encodeURIComponent(verification_code)}`
      : "";

  const subject = `Invitación a firmar: ${document_title || "Documento"}`;

  // QR apuntando preferentemente a la URL de firma
  const qrTargetUrl = signUrl || publicVerifyUrl;
  const qrDataUrl = await generateQrDataUrl(qrTargetUrl);

  const safeSignerName = signer_name || "";
  const safeDocumentTitle = document_title || "Documento";

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
                Hola <strong>${safeSignerName}</strong>,
              </p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563;">
                Has sido invitado a revisar y firmar electrónicamente el siguiente documento en <strong>VeriFirma</strong>:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;font-size:13px;border-radius:12px;background-color:#f9fafb;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:10px 14px;width:40%;color:#6b7280;">Título del documento</td>
                  <td style="padding:10px 14px;font-weight:600;">${safeDocumentTitle}</td>
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
                  : `
              <p style="margin:8px 0 16px;font-size:13px;line-height:1.5;color:#b91c1c;">
                ⚠ No se pudo generar el enlace directo de firma porque falta el token de firma.
                Contacta al emisor del documento o al soporte de VeriFirma.
              </p>`
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
    console.log("📧 [EMAIL] Enviando invitación", {
      to: signer_email,
      subject,
      signUrl,
      publicVerifyUrl,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: signer_email,
      subject,
      html,
    });

    console.log("📧 [EMAIL] Enviado OK, messageId:", info && info.messageId);
    return true;
  } catch (error) {
    console.error("📧 [EMAIL] Error enviando correo:", error.message);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };