// backend/services/emailService.js
const { MailtrapClient } = require('mailtrap');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { uploadBufferToS3, getSignedUrl } = require('./storageR2');

console.log('📬 [EMAIL] Cargando emailService.js (Mailtrap API)');

const TOKEN = process.env.MAILTRAP_TOKEN || process.env.MAILTRAP_API_TOKEN;
const SENDER_EMAIL = process.env.MAILTRAP_SENDER_EMAIL;
const SENDER_NAME = process.env.MAILTRAP_SENDER_NAME || 'VeriFirma';

// URL pública fija de verificación de documentos
const PUBLIC_VERIFY_BASE_URL = 'https://docdigital-demo.onrender.com/verificar';

// DEBUG: ver qué llega desde Render
console.log('🔎 [EMAIL] DEBUG ENV:', {
  MAILTRAP_TOKEN: TOKEN ? '[OK] token presente' : '[FALTA]',
  MAILTRAP_SENDER_EMAIL: SENDER_EMAIL || '[FALTA]',
  MAILTRAP_SENDER_NAME: SENDER_NAME || '[FALTA]',
});

if (!TOKEN || !SENDER_EMAIL) {
  console.warn('⚠️ [EMAIL] Faltan variables MAILTRAP_TOKEN o MAILTRAP_SENDER_EMAIL', {
    MAILTRAP_TOKEN: !!TOKEN,
    MAILTRAP_SENDER_EMAIL: !!SENDER_EMAIL,
  });
}

const client = new MailtrapClient({ token: TOKEN });
const sender = { name: SENDER_NAME, email: SENDER_EMAIL };

/**
 * Enviar email genérico HTML con Mailtrap
 */
async function sendEmail({ to, subject, html }) {
  if (!TOKEN || !SENDER_EMAIL) {
    console.error('❌ [EMAIL] Mailtrap API no configurada correctamente');
    return false;
  }

  try {
    console.log('📬 [EMAIL] Enviando email (Mailtrap API):', { to, subject });

    await client.send({
      from: sender,
      to: [{ email: to }],
      subject,
      html,
      category: 'Transactional',
    });

    console.log('✅ [EMAIL] Enviado OK (Mailtrap API)');
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Error enviando email (Mailtrap API):', error.message);
    return false;
  }
}

/**
 * Genera un PNG de QR, lo sube a R2 y devuelve una URL firmada
 */
async function generateQrImageUrl(targetUrl) {
  if (!targetUrl) return '';

  try {
    const buffer = await QRCode.toBuffer(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });

    const key = `qrs/email-${crypto.randomUUID()}.png`;
    await uploadBufferToS3(buffer, key, 'image/png');

    // URL firmada por 7 días (puedes ajustar)
    const url = await getSignedUrl(key, 7 * 24 * 3600);
    return url;
  } catch (err) {
    console.error('❌ [EMAIL] Error generando/subiendo QR:', err.message);
    return '';
  }
}

/**
 * Invitación a firmar
 * Incluye:
 * - Código de verificación del documento
 * - Texto explicando su uso
 * - QR hospedado en R2 (compatible con Gmail)
 */
async function sendSigningInvitation(
  email,
  docTitle,
  signUrl,
  signerName = '',
  {
    verificationCode = '',
    // dejamos publicVerifyUrl para futuro, pero la URL principal es fija
    publicVerifyUrl = '',
    qrTargetUrl = '',
  } = {}
) {
  const subject = `Invitación a firmar: ${docTitle}`;

  // URL de verificación pública (opcionalmente con query si quieres prellenar)
  const verificationUrl = verificationCode
    ? `${PUBLIC_VERIFY_BASE_URL}?code=${encodeURIComponent(verificationCode)}`
    : PUBLIC_VERIFY_BASE_URL;

  // El QR sigue apuntando a la URL de firma (o lo que pases en qrTargetUrl)
  const qrUrlTarget = qrTargetUrl || signUrl || publicVerifyUrl || verificationUrl;
  const qrImageUrl = await generateQrImageUrl(qrUrlTarget);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #0f172a; padding: 24px 0; }
          .container { max-width: 640px; margin: 0 auto; padding: 24px 24px 32px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35); }
          .header { text-align: center; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
          .badge { display: inline-block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #60a5fa; background: #eff6ff; padding: 4px 10px; border-radius: 999px; margin-bottom: 4px; }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 4px 0 8px; }
          .content { margin: 20px 0 8px; font-size: 14px; color: #374151; }
          .doc-title { font-size: 16px; font-weight: 700; color: #111827; margin: 12px 0; }
          .button { display: inline-block; background-color: #2563eb; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 999px; margin: 20px 0 8px; font-weight: 600; font-size: 14px; }
          .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .verify-box { margin-top: 24px; padding: 14px 16px; border-radius: 12px; background: #f9fafb; border: 1px dashed #d1d5db; font-size: 13px; color: #374151; }
          .verify-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 700; font-size: 14px; background: #111827; color: #e5e7eb; padding: 4px 8px; border-radius: 8px; display: inline-block; margin: 4px 0; letter-spacing: 2px; }
          .qr-wrapper { margin-top: 16px; text-align: center; }
          .qr-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
          .qr-img { display: inline-block; padding: 6px; border-radius: 12px; background: #111827; }
          .qr-img img { display: block; width: 144px; height: 144px; }
          .footer { font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; }
          a { color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">VeriFirma</div>
            <h2 class="title">Invitación a Firmar Documento</h2>
          </div>

          <div class="content">
            <p>Hola ${signerName || ''}</p>
            <p>
              Has recibido una invitación para <strong>firmar electrónicamente</strong> el siguiente documento en
              <strong>VeriFirma</strong>:
            </p>

            <p class="doc-title">${docTitle}</p>

            <a href="${signUrl}" class="button">Ir a Firmar Documento</a>
            <p class="meta">Este enlace es válido por 30 días.</p>
          </div>

          <div class="verify-box">
            <p style="margin: 0 0 6px;"><strong>Verificación independiente del documento</strong></p>
            ${
              verificationCode
                ? `
              <p style="margin: 0 0 4px;">
                Código de verificación del documento:
                <span class="verify-code">${verificationCode}</span>
              </p>
              <p style="margin: 6px 0 4px;">
                Puedes comprobar la validez de este documento en cualquier momento entrando a
                <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer">
                  https://docdigital-demo.onrender.com/verificar
                </a>
                e ingresando el código anterior.
              </p>
              <p style="margin: 4px 0 0;">
                Te recomendamos conservar este código junto al PDF firmado.
              </p>
            `
                : `
              <p style="margin: 0;">
                Este documento cuenta con un código de verificación interno en VeriFirma.
              </p>
            `
            }

            ${
              qrImageUrl
                ? `
              <div class="qr-wrapper">
                <div class="qr-label">
                  También puedes escanear este código QR para ir directamente al flujo del documento:
                </div>
                <div class="qr-img">
                  <img src="${qrImageUrl}" alt="QR de acceso al documento" />
                </div>
              </div>
            `
                : ''
            }
          </div>

          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Invitación a visar
 */
async function sendVisadoInvitation(email, docTitle, signUrl, visadorName = '') {
  const subject = `Invitación a visar: ${docTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { margin: 20px 0; }
          .button { display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✓ Invitación a Visar Documento</h2>
          </div>
          <div class="content">
            <p>Hola ${visadorName || ''}</p>
            <p>Has recibido una invitación para <strong>visar</strong> el siguiente documento en <strong>VeriFirma</strong>:</p>
            <p style="font-size: 16px; font-weight: bold; color: #1e293b;">${docTitle}</p>
            <p>El visado valida el contenido y estado del documento.</p>
            <a href="${signUrl}" class="button">Ir a Visar Documento</a>
            <p style="color: #666; font-size: 14px;">Este enlace es válido por 30 días.</p>
          </div>
          <div class="footer">
            <p>© 2026 VeriFirma - Plataforma de Firma Digital</p>
            <p>Este es un email automático, por favor no respondas.</p>
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

module.exports = {
  sendEmail,
  sendSigningInvitation,
  sendVisadoInvitation,
  sendNotification,
};
