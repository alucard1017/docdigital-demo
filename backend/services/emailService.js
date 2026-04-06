// backend/services/emailService.js
const QRCode = require("qrcode");
const crypto = require("crypto");
const { sendEmailHttp } = require("./brevoHttp");
const { uploadBufferToS3, getSignedUrl } = require("./storageR2");

console.log("📬 [EMAIL] Cargando emailService.js (Brevo API HTTP)");

/* ===================================
   Configuración base de URLs
   =================================== */

function normalizeUrl(value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) return "";
  // Forzamos https si el valor no incluye protocolo
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return raw;
}

const PUBLIC_VERIFY_BASE_URL = normalizeUrl(
  process.env.PUBLIC_VERIFY_URL,
  "https://app.verifirma.cl/verificar"
);

const DASHBOARD_BASE_URL = normalizeUrl(
  process.env.DASHBOARD_URL,
  "https://app.verifirma.cl"
);

/* ===================================
   Utilidades
   =================================== */

async function generateQrImageUrl(targetUrl) {
  if (!targetUrl) return "";

  try {
    const buffer = await QRCode.toBuffer(targetUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });

    const key = `qrs/email-${crypto.randomUUID()}.png`;
    await uploadBufferToS3(key, buffer, "image/png");

    const url = await getSignedUrl(key, 7 * 24 * 3600);
    return url;
  } catch (err) {
    console.error("❌ [EMAIL] Error generando/subiendo QR:", err.message);
    return "";
  }
}

function formatDateCL(dateLike) {
  if (!dateLike) return "Fecha no disponible";
  try {
    return new Date(dateLike).toLocaleString("es-CL");
  } catch {
    return String(dateLike);
  }
}

function safeSubject(prefix, title) {
  const cleanTitle = String(title || "").trim() || "Documento";
  return `${prefix}: ${cleanTitle}`.slice(0, 255);
}

function safeName(name, fallback = "") {
  const text = String(name || "").trim();
  return text || fallback;
}

/* ===================================
   Wrapper genérico de envío
   =================================== */

// Wrapper genérico para enviar HTML usando Brevo HTTP
// con logging detallado y tracking en BD
async function sendEmail({
  to,
  subject,
  html,
  documentoId = null,
  firmanteId = null,
}) {
  const trackingId = crypto.randomUUID();
  const cleanTo = String(to || "").trim();

  console.log("📬 [EMAIL] Intentando enviar email:", {
    to: cleanTo,
    subject,
    documentoId,
    firmanteId,
    trackingId,
  });

  if (!cleanTo) {
    console.error("❌ [EMAIL] Envío cancelado: destinatario vacío", {
      subject,
      documentoId,
      firmanteId,
      trackingId,
    });
    return false;
  }

  try {
    const result = await sendEmailHttp({
      to: cleanTo,
      subject,
      html,
      headers: {
        "X-Mailin-custom": JSON.stringify({
          documentoId,
          firmanteId,
          trackingId,
        }),
      },
    });

    if (!result || result.ok !== true) {
      console.error("❌ [EMAIL] Falló el envío (Brevo HTTP):", {
        to: cleanTo,
        subject,
        documentoId,
        firmanteId,
        trackingId,
        status: result?.status ?? null,
        error: result?.error ?? null,
        data: result?.data ?? null,
      });
      return false;
    }

    console.log("✅ [EMAIL] Envío aceptado por Brevo:", {
      to: cleanTo,
      subject,
      documentoId,
      firmanteId,
      trackingId,
      status: result.status,
      messageId: result.data?.messageId ?? null,
    });

    if (documentoId) {
      const db = require("../db");
      try {
        await db.query(
          `INSERT INTO email_tracking (
             documento_id,
             firmante_id,
             email,
             event_type,
             tracking_id,
             created_at
           )
           VALUES ($1, $2, $3, 'sent', $4, NOW())`,
          [documentoId, firmanteId || null, cleanTo, trackingId]
        );
        console.log(
          `📊 [EMAIL] Email tracking registrado (sent) para ${cleanTo} - documento ${documentoId}`
        );
      } catch (err) {
        console.error(
          "❌ [EMAIL] Error registrando email tracking en BD:",
          err.message
        );
      }
    }

    return true;
  } catch (err) {
    console.error("❌ [EMAIL] Excepción al enviar email:", {
      to: cleanTo,
      subject,
      documentoId,
      firmanteId,
      trackingId,
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return false;
  }
}

/* ===================================
   CSS base para todos los templates
   =================================== */

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

/* ===================================
   Templates
   =================================== */

async function sendSigningInvitation(
  email,
  docTitle,
  signUrl,
  signerName = "",
  options = {}
) {
  const {
    verificationCode = "",
    qrTargetUrl = "",
    documentoId = null,
    firmanteId = null,
  } = options;

  const subject = safeSubject("Invitación a firmar", docTitle);

  const verificationUrl = verificationCode
    ? `${PUBLIC_VERIFY_BASE_URL}?code=${encodeURIComponent(verificationCode)}`
    : PUBLIC_VERIFY_BASE_URL;

  const qrUrlTarget = qrTargetUrl || signUrl || verificationUrl;
  const qrImageUrl = await generateQrImageUrl(qrUrlTarget);

  const safeSignerName = safeName(signerName, "");

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
            <p>Hola ${
              safeSignerName ? `<strong>${safeSignerName}</strong>` : ""
            },</p>
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
              <h4>🔐 Verificación independiente</h4>
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
              Este es un correo automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    documentoId,
    firmanteId,
  });
}

async function sendVisadoInvitation(
  email,
  docTitle,
  signUrl,
  visadorName = "",
  options = {}
) {
  const { documentoId = null } = options;
  const subject = safeSubject("Invitación a visar", docTitle);
  const safeVisadorName = safeName(visadorName, "");

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
            <p>Hola ${
              safeVisadorName ? `<strong>${safeVisadorName}</strong>` : ""
            },</p>
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
              Este es un correo automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    documentoId,
  });
}

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
  const subject = safeSubject("⚠️ Documento rechazado", docTitle);
  const dashboardUrl = documentId
    ? `${DASHBOARD_BASE_URL}/#/documento/${documentId}`
    : DASHBOARD_BASE_URL;

  const safeEmisorName = safeName(emisorName, "");
  const safeFirmanteName = safeName(firmanteNombre, "Firmante");
  const safeFirmanteEmail = String(firmanteEmail || "").trim() || "Correo no disponible";
  const safeMotivo = String(motivo || "").trim() || "No especificado";

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
            <p>Hola ${
              safeEmisorName ? `<strong>${safeEmisorName}</strong>` : ""
            },</p>
            <p style="color: #b91c1c; font-weight: 600;">
              El siguiente documento ha sido rechazado por uno de los firmantes:
            </p>

            <div class="doc-title danger">${docTitle}</div>
          </div>

          <div class="info-box danger">
            <h4>📋 Detalles del rechazo</h4>
            <ul class="details-list">
              <li><strong>Rechazado por:</strong> ${safeFirmanteName} (${safeFirmanteEmail})</li>
              <li><strong>Fecha:</strong> ${formatDateCL(fechaRechazo)}</li>
              <li><strong>Motivo:</strong> <em>${safeMotivo}</em></li>
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
              Este es un correo automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: emisorEmail,
    subject,
    html,
    documentoId: documentId,
  });
}

async function sendReminder(
  email,
  docTitle,
  signUrl,
  recipientName = "",
  tipo = "FIRMA",
  options = {}
) {
  const { documentoId = null, firmanteId = null } = options;

  const subject = safeSubject(
    `Recordatorio: ${tipo === "VISADO" ? "Visar" : "Firmar"} documento`,
    docTitle
  );

  const safeRecipientName = safeName(recipientName, "");

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
            <p>Hola ${
              safeRecipientName ? `<strong>${safeRecipientName}</strong>` : ""
            },</p>
            <p>
              Te recordamos que tienes pendiente ${
                tipo === "VISADO" ? "visar" : "firmar"
              } 
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
              Este documento lleva varios días esperando tu ${
                tipo === "VISADO" ? "visación" : "firma"
              }. 
              Por favor, revisa el contenido y completa la acción a la brevedad.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un correo automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    documentoId,
    firmanteId,
  });
}

async function sendNotification(email, subject, html) {
  return sendEmail({
    to: email,
    subject,
    html,
  });
}

async function sendDestinationNotification(
  email,
  docTitle,
  empresaNombre,
  verificationCode = ""
) {
  const subject = safeSubject("Notificación de trámite", docTitle);

  const verificationUrl = verificationCode
    ? `${PUBLIC_VERIFY_BASE_URL}?code=${encodeURIComponent(verificationCode)}`
    : PUBLIC_VERIFY_BASE_URL;

  const safeEmpresaNombre = safeName(empresaNombre, "Cliente");

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
            <h2 class="title">Notificación de Trámite</h2>
            <p class="subtitle">Documento en proceso</p>
          </div>

          <div class="content">
            <p>Hola <strong>${safeEmpresaNombre}</strong>,</p>
            <p>
              Te informamos que se ha iniciado un trámite de firma electrónica 
              para el siguiente documento:
            </p>

            <div class="doc-title">${docTitle}</div>

            <p>
              Este es un correo <strong>informativo</strong>. No necesitas tomar acción. 
              El documento está siendo procesado y firmado por las partes correspondientes.
            </p>
          </div>

          ${
            verificationCode
              ? `
            <div class="info-box">
              <h4>🔐 Verificación del documento</h4>

              <p>
                Puedes verificar el estado y autenticidad de este documento en cualquier 
                momento usando el siguiente código:
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
                Recibirás una copia del documento firmado una vez completado el proceso.
              </p>
            </div>
          `
              : ""
          }

          <div class="info-box">
            <p style="margin: 0;">
              📋 <strong>Nota:</strong> Este documento está siendo firmado electrónicamente 
              por los representantes autorizados. No necesitas realizar ninguna acción.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
            <p>
              <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
            </p>
            <p style="color: #9ca3af; font-size: 10px;">
              Este es un correo automático, por favor no respondas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/* ===================================
   EXPORTAR
   =================================== */

module.exports = {
  sendEmail,
  sendSigningInvitation,
  sendVisadoInvitation,
  sendRejectionNotification,
  sendReminder,
  sendNotification,
  sendDestinationNotification,
};