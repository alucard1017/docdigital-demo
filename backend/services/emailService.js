// backend/services/emailService.js
const { MailtrapClient } = require("mailtrap");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { uploadBufferToS3, getSignedUrl } = require("./storageR2");

console.log("📬 [EMAIL] Cargando emailService.js (Mailtrap API)");

const TOKEN = process.env.MAILTRAP_TOKEN || process.env.MAILTRAP_API_TOKEN;
const SENDER_EMAIL = process.env.MAILTRAP_SENDER_EMAIL;
const SENDER_NAME = process.env.MAILTRAP_SENDER_NAME || "VeriFirma";

// URL pública fija de verificación de documentos
const PUBLIC_VERIFY_BASE_URL =
  process.env.PUBLIC_VERIFY_URL || "https://app.verifirma.cl/verificar";

// URL del dashboard interno (para que el emisor vea detalles del rechazo)
const DASHBOARD_BASE_URL =
  process.env.DASHBOARD_URL || "https://app.verifirma.cl";

// DEBUG: ver qué llega desde Render
console.log("🔎 [EMAIL] DEBUG ENV:", {
  MAILTRAP_TOKEN: TOKEN ? "[OK] token presente" : "[FALTA]",
  MAILTRAP_SENDER_EMAIL: SENDER_EMAIL || "[FALTA]",
  MAILTRAP_SENDER_NAME: SENDER_NAME || "[FALTA]",
  PUBLIC_VERIFY_BASE_URL,
  DASHBOARD_BASE_URL,
});

if (!TOKEN || !SENDER_EMAIL) {
  console.warn(
    "⚠️ [EMAIL] Faltan variables MAILTRAP_TOKEN o MAILTRAP_SENDER_EMAIL",
    {
      MAILTRAP_TOKEN: !!TOKEN,
      MAILTRAP_SENDER_EMAIL: !!SENDER_EMAIL,
    }
  );
}

const client = new MailtrapClient({ token: TOKEN });
const sender = { name: SENDER_NAME, email: SENDER_EMAIL };

/* ================================
   Utilidades
   ================================ */

/**
 * Enviar email genérico HTML con Mailtrap
 */
async function sendEmail({ to, subject, html }) {
  if (!TOKEN || !SENDER_EMAIL) {
    console.error("❌ [EMAIL] Mailtrap API no configurada correctamente");
    return false;
  }

  try {
    console.log("📬 [EMAIL] Enviando email (Mailtrap API):", { to, subject });

    await client.send({
      from: sender,
      to: [{ email: to }],
      subject,
      html,
      category: "Transactional",
    });

    console.log("✅ [EMAIL] Enviado OK (Mailtrap API)");
    return true;
  } catch (error) {
    console.error(
      "❌ [EMAIL] Error enviando email (Mailtrap API):",
      error.message
    );
    return false;
  }
}

/**
 * Genera un PNG de QR, lo sube a R2 y devuelve una URL firmada
 */
async function generateQrImageUrl(targetUrl) {
  if (!targetUrl) return "";

  try {
    const buffer = await QRCode.toBuffer(targetUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });

    const key = `qrs/email-${crypto.randomUUID()}.png`;
    await uploadBufferToS3(buffer, key, "image/png");

    // URL firmada por 7 días
    const url = await getSignedUrl(key, 7 * 24 * 3600);
    return url;
  } catch (err) {
    console.error("❌ [EMAIL] Error generando/subiendo QR:", err.message);
    return "";
  }
}

/**
 * CSS base reutilizable para todos los templates
 */
const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #111827;
    background-color: #0f172a;
    padding: 24px 0;
    margin: 0;
  }
  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
  }
  .header {
    text-align: center;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 20px;
  }
  .badge {
    display: inline-block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #60a5fa;
    background: #eff6ff;
    padding: 6px 12px;
    border-radius: 999px;
    margin-bottom: 8px;
  }
  .badge.warning {
    color: #d97706;
    background: #fef3c7;
  }
  .badge.danger {
    color: #b91c1c;
    background: #fee2e2;
  }
  .title {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  .subtitle {
    font-size: 14px;
    color: #6b7280;
    margin: 4px 0 0;
  }
  .content {
    margin: 20px 0;
    font-size: 14px;
    color: #374151;
    line-height: 1.8;
  }
  .content p {
    margin: 12px 0;
  }
  .doc-title {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    margin: 16px 0 8px;
    padding: 12px;
    background: #f9fafb;
    border-left: 4px solid #2563eb;
    border-radius: 6px;
  }
  .doc-title.danger {
    background: #fef2f2;
    border-left-color: #b91c1c;
  }
  .button {
    display: inline-block;
    background-color: #2563eb;
    color: white !important;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 8px;
    margin: 16px 0;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    border: none;
    text-align: center;
  }
  .button.secondary {
    background-color: #6b7280;
  }
  .button.warning {
    background-color: #f59e0b;
  }
  .button.danger {
    background-color: #b91c1c;
  }
  .button:hover {
    opacity: 0.9;
  }
  .meta {
    font-size: 12px;
    color: #6b7280;
    margin-top: 6px;
  }
  .info-box {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 12px;
    background: #f9fafb;
    border: 1px dashed #d1d5db;
    font-size: 13px;
    color: #374151;
  }
  .info-box.warning {
    background: #fffbeb;
    border-color: #fcd34d;
    color: #92400e;
  }
  .info-box.danger {
    background: #fef2f2;
    border-color: #fecaca;
    color: #7f1d1d;
  }
  .info-box h4 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
  }
  .info-box p {
    margin: 6px 0;
  }
  .info-box ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  .info-box li {
    margin: 4px 0;
  }
  .verify-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-weight: 700;
    font-size: 13px;
    background: #111827;
    color: #e5e7eb;
    padding: 6px 10px;
    border-radius: 6px;
    display: inline-block;
    margin: 4px 0;
    letter-spacing: 1px;
  }
  .qr-wrapper {
    margin-top: 16px;
    text-align: center;
  }
  .qr-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 8px;
  }
  .qr-img {
    display: inline-block;
    padding: 8px;
    border-radius: 12px;
    background: #111827;
  }
  .qr-img img {
    display: block;
    width: 144px;
    height: 144px;
  }
  .details-list {
    list-style: none;
    padding: 0;
    margin: 8px 0;
  }
  .details-list li {
    padding: 8px;
    margin: 4px 0;
    background: #f3f4f6;
    border-radius: 6px;
    font-size: 13px;
  }
  .details-list strong {
    color: #111827;
  }
  .footer {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 24px;
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
    text-align: center;
  }
  .footer p {
    margin: 4px 0;
  }
  a {
    color: #2563eb;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  @media (max-width: 600px) {
    .container {
      padding: 16px;
    }
    .title {
      font-size: 18px;
    }
    .button {
      width: 100%;
      display: block;
    }
  }
`;

/* ================================
   Templates
   ================================ */

/**
 * Invitación a FIRMAR documento
 */
async function sendSigningInvitation(
  email,
  docTitle,
  signUrl,
  signerName = "",
  { verificationCode = "", qrTargetUrl = "" } = {}
) {
  const subject = `Invitación a firmar: ${docTitle}`;

  const verificationUrl = verificationCode
    ? `${PUBLIC_VERIFY_BASE_URL}?code=${encodeURIComponent(verificationCode)}`
    : PUBLIC_VERIFY_BASE_URL;

  const qrUrlTarget = qrTargetUrl || signUrl || verificationUrl;
  const qrImageUrl = await generateQrImageUrl(qrUrlTarget);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">VeriFirma</div>
            <h2 class="title">Invitación a Firmar Documento</h2>
            <p class="subtitle">Firma electrónica segura</p>
          </div>

          <div class="content">
            <p>Hola ${signerName ? `<strong>${signerName}</strong>` : ""},</p>
            <p>
              Has recibido una invitación para <strong>firmar electrónicamente</strong> 
              el siguiente documento:
            </p>

            <div class="doc-title">${docTitle}</div>

            <div style="text-align: center;">
              <a href="${signUrl}" class="button">Ir a Firmar Documento</a>
              <p class="meta">Este enlace es válido por 30 días.</p>
            </div>
          </div>

          <div class="info-box warning">
            <h4>💡 ¿Tienes dudas sobre el documento?</h4>
            <p>
              Si no estás de acuerdo con el contenido del documento, 
              <strong>puedes rechazarlo indicando el motivo</strong> 
              directamente en el enlace de firma. Esta acción alertará 
              al emisor y quedará registrada en el historial del documento.
            </p>
          </div>

          ${
            verificationCode
              ? `
            <div class="info-box">
              <h4>🔐 Verificación Independiente</h4>
              <p>
                Puedes comprobar la validez de este documento en cualquier 
                momento con el siguiente código:
              </p>
              <div style="text-align: center; margin: 12px 0;">
                <span class="verify-code">${verificationCode}</span>
              </div>
              <p>
                Ingresa este código en
                <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer">
                  ${PUBLIC_VERIFY_BASE_URL}
                </a>
              </p>
              <p style="font-size: 12px; margin: 8px 0 0; font-style: italic;">
                Te recomendamos guardar este código junto con el PDF firmado.
              </p>
            </div>
            ${
              qrImageUrl
                ? `
              <div class="qr-wrapper">
                <div class="qr-label">O escanea este código QR:</div>
                <div class="qr-img">
                  <img src="${qrImageUrl}" alt="QR de verificación" />
                </div>
              </div>
            `
                : ""
            }
          `
              : ""
          }

          <div class="info-box">
            <p style="margin: 0;">
              ⚠️ <strong>Seguridad:</strong> No compartas estos enlaces con terceros. 
              Los enlaces personales son únicos y pueden identificarte.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un email automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Invitación a VISAR documento
 */
async function sendVisadoInvitation(
  email,
  docTitle,
  signUrl,
  visadorName = ""
) {
  const subject = `Invitación a visar: ${docTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge warning">VeriFirma</div>
            <h2 class="title">Invitación a Visar Documento</h2>
            <p class="subtitle">Validación administrativa</p>
          </div>

          <div class="content">
            <p>Hola ${visadorName ? `<strong>${visadorName}</strong>` : ""},</p>
            <p>
              Has recibido una solicitud para <strong>visar</strong> el siguiente documento:
            </p>

            <div class="doc-title">${docTitle}</div>

            <p style="font-size: 13px; color: #6b7280; font-style: italic;">
              La visación es un paso de validación que confirma que el documento 
              ha sido revisado y cumple con los requisitos administrativos necesarios.
            </p>

            <div style="text-align: center;">
              <a href="${signUrl}" class="button warning">Ir a Visar Documento</a>
              <p class="meta">Este enlace es válido por 30 días.</p>
            </div>
          </div>

          <div class="info-box">
            <p style="margin: 0;">
              ⚠️ <strong>Importante:</strong> El visado NO equivale a la firma definitiva 
              del representante legal. Es un paso previo de validación interna.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un email automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Notificación al EMISOR cuando un documento es RECHAZADO
 */
async function sendRejectionNotification(
  emisorEmail,
  emisorName = "",
  docTitle,
  firmanteNombre,
  firmanteEmail,
  motivo,
  fechaRechazo,
  documentId = null
) {
  const subject = `⚠️ Documento rechazado: ${docTitle}`;

  const dashboardUrl = documentId
    ? `${DASHBOARD_BASE_URL}/#/documento/${documentId}`
    : DASHBOARD_BASE_URL;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge danger">VeriFirma</div>
            <h2 class="title" style="color: #b91c1c;">⚠️ Documento Rechazado</h2>
            <p class="subtitle">Notificación de rechazo</p>
          </div>

          <div class="content">
            <p>Hola ${emisorName ? `<strong>${emisorName}</strong>` : ""},</p>
            <p style="color: #b91c1c; font-weight: 600;">
              El siguiente documento ha sido rechazado por uno de los firmantes:
            </p>

            <div class="doc-title danger">${docTitle}</div>
          </div>

          <div class="info-box danger">
            <h4>📋 Detalles del rechazo</h4>
            <ul class="details-list">
              <li><strong>Rechazado por:</strong> ${firmanteNombre} (${firmanteEmail})</li>
              <li><strong>Fecha:</strong> ${new Date(fechaRechazo).toLocaleString("es-CL")}</li>
              <li><strong>Motivo:</strong> <em>${motivo || "No especificado"}</em></li>
            </ul>
          </div>

          <div class="content">
            <p>
              Por favor, revisa el motivo indicado y toma las acciones necesarias 
              para corregir los problemas reportados. Puedes crear un nuevo documento 
              una vez resueltas las observaciones.
            </p>

            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">Ver Detalles en VeriFirma</a>
            </div>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un email automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: emisorEmail, subject, html });
}

/**
 * Recordatorio automático (7 días sin actividad)
 */
async function sendReminder(
  email,
  docTitle,
  signUrl,
  recipientName = "",
  tipo = "FIRMA"
) {
  const subject = `Recordatorio: ${tipo === "VISADO" ? "Visar" : "Firmar"} documento "${docTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">VeriFirma</div>
            <h2 class="title">Recordatorio Pendiente</h2>
            <p class="subtitle">Acción requerida</p>
          </div>

          <div class="content">
            <p>Hola ${recipientName ? `<strong>${recipientName}</strong>` : ""},</p>
            <p>
              Te recordamos que tienes pendiente ${tipo === "VISADO" ? "visar" : "firmar"} 
              el siguiente documento:
            </p>

            <div class="doc-title">${docTitle}</div>

            <div style="text-align: center;">
              <a href="${signUrl}" class="button">
                ${tipo === "VISADO" ? "Ir a Visar" : "Ir a Firmar"} Documento
              </a>
            </div>
          </div>

          <div class="info-box warning">
            <h4>⏰ Acción pendiente</h4>
            <p>
              Este documento lleva varios días esperando tu ${tipo === "VISADO" ? "visación" : "firma"}. 
              Por favor, revisa el contenido y completa la acción a la brevedad.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un email automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Notificación genérica HTML
 */
async function sendNotification(email, subject, html) {
  return sendEmail({ to: email, subject, html });
}

/* ================================
   EXPORTAR
   ================================ */

module.exports = {
  sendEmail,
  sendSigningInvitation,
  sendVisadoInvitation,
  sendRejectionNotification,  // ← NUEVO
  sendReminder,                // ← NUEVO
  sendNotification,
};            
