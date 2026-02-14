// backend/services/sendSignatureInviteEmail.js
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
require('dotenv').config();

console.log('DEBUG EMAIL >> Cargando sendSignatureInviteEmail.js');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
  console.warn('DEBUG EMAIL >> Faltan variables SMTP:', {
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
  if (!url) return '';
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });
    return dataUrl;
  } catch (err) {
    console.error('DEBUG EMAIL >> error generando QR:', err.message);
    return '';
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
  sign_url,
  verification_code,     // nuevo
  public_verify_url,     // nuevo (URL de /verificar en tu frontend)
}) {
  const fromEmail = SMTP_FROM_EMAIL;
  const fromName = SMTP_FROM_NAME || 'Firma Digital';

  const subject = `Invitación a firmar: ${document_title}`;

  // Generar QR que apunta a la URL de firma (o a la de verificación)
  const qrTargetUrl = sign_url || public_verify_url;
  const qrDataUrl = await generateQrDataUrl(qrTargetUrl);

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
          .verify-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 700; font-size: 14px; background: #111827; color: #e5e7eb; padding: 4px 8px; border-radius: 8px; display: inline-block; margin: 4px 0; }
          .verify-link { color: #2563eb; text-decoration: underline; }
          .qr-wrapper { margin-top: 16px; text-align: center; }
          .qr-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
          .qr-img { display: inline-block; padding: 6px; border-radius: 12px; background: #111827; }
          .qr-img img { display: block; width: 144px; height: 144px; }
          .footer { font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">Firma Digital</div>
            <h2 class="title">Invitación a Firmar Documento</h2>
          </div>

          <div class="content">
            <p>Hola ${signer_name || ''}</p>
            <p>
              Has sido invitado a firmar el documento
              <strong>"${document_title}"</strong>.
            </p>
            <p>Puedes revisarlo y firmarlo haciendo clic en el siguiente botón:</p>

            <a href="${sign_url}" class="button">Firmar documento ahora</a>
            <p class="meta">Si no reconoces esta solicitud, puedes ignorar este correo.</p>
          </div>

          <div class="verify-box">
            <p style="margin: 0 0 6px;"><strong>Verificación del documento</strong></p>
            ${
              verification_code
                ? `
              <p style="margin: 0;">
                Código de verificación del documento:
                <span class="verify-code">${verification_code}</span>
              </p>
            `
                : ''
            }
            ${
              public_verify_url
                ? `
              <p style="margin: 6px 0 0;">
                Puedes ir a
                <a href="${public_verify_url}" class="verify-link">${public_verify_url}</a>
                y pegar este código para consultar el estado del documento.
              </p>
            `
                : ''
            }

            ${
              qrDataUrl
                ? `
              <div class="qr-wrapper">
                <div class="qr-label">
                  O escanea este código QR para acceder rápidamente:
                </div>
                <div class="qr-img">
                  <img src="${qrDataUrl}" alt="QR de acceso al documento" />
                </div>
              </div>
            `
                : ''
            }
          </div>

          <div class="footer">
            <p>© 2026 Firma Digital</p>
            <p>Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    console.log('DEBUG EMAIL >> preparando envío', {
      to: signer_email,
      subject,
      sign_url,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: signer_email,
      subject,
      html,
    });

    console.log('DEBUG EMAIL >> enviado OK, messageId:', info && info.messageId);
    return true;
  } catch (error) {
    console.error('DEBUG EMAIL >> error enviando correo:', error.message);
    return false;
  }
}

module.exports = { sendSignatureInviteEmail };
