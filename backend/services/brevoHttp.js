// backend/services/brevoHttp.js
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL || "verifirma.cl@gmail.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "VeriFirma";

/**
 * Envío HTTP directo a Brevo.
 * Soporta:
 * - to: string o array de { email, name? }
 * - attachments: [{ url, name }]
 */
async function sendEmailHttp({
  to,
  subject,
  html,
  headers = {},
  attachments = [],
}) {
  if (!BREVO_API_KEY || !SENDER_EMAIL) {
    const message = "Falta BREVO_API_KEY o BREVO_SENDER_EMAIL";
    console.error("❌ [BREVO HTTP]", message);

    return {
      ok: false,
      status: null,
      data: null,
      error: message,
    };
  }

  const cleanSubject = String(subject || "").trim();
  const cleanHtml = String(html || "").trim();

  if (!to || !cleanSubject || !cleanHtml) {
    const message = "Falta to/subject/html en sendEmailHttp";
    console.error("❌ [BREVO HTTP]", message, {
      to,
      subject: cleanSubject,
    });

    return {
      ok: false,
      status: null,
      data: null,
      error: message,
    };
  }

  // Normalizar destinatarios al formato [{ email, name? }]
  const toArray = Array.isArray(to) ? to : [to];
  const brevoTo = toArray
    .map((item) => {
      if (typeof item === "string") {
        const email = item.trim();
        if (!email) return null;
        return { email };
      }
      if (item && typeof item.email === "string") {
        const email = item.email.trim();
        if (!email) return null;
        const name =
          typeof item.name === "string" ? item.name.trim() : undefined;
        return name ? { email, name } : { email };
      }
      return null;
    })
    .filter(Boolean);

  if (brevoTo.length === 0) {
    const message = "Lista de destinatarios vacía después de normalizar";
    console.error("❌ [BREVO HTTP]", message, { to });
    return {
      ok: false,
      status: null,
      data: null,
      error: message,
    };
  }

  const payload = {
    sender: {
      email: SENDER_EMAIL,
      name: SENDER_NAME,
    },
    to: brevoTo,
    subject: cleanSubject,
    htmlContent: cleanHtml,
    headers,
  };

  // Adjuntos: Brevo usa "attachment" con [{ url, name }]
  // https://developers.brevo.com/reference/send-transac-email
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments
      .map((att) => {
        const url = String(att?.url || "").trim();
        const name = String(att?.name || "").trim();
        if (!url || !name) return null;
        return { url, name };
      })
      .filter(Boolean);
  }

  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ [BREVO HTTP] Enviado:", {
      status: res.status,
      data: res.data,
    });

    return {
      ok: true,
      status: res.status,
      data: res.data,
      error: null,
    };
  } catch (err) {
    const status = err.response?.status ?? null;
    const data = err.response?.data ?? null;
    const errorMessage =
      data?.message || err.message || "Error desconocido enviando correo";

    console.error("❌ [BREVO HTTP] Error:", {
      status,
      data,
      message: errorMessage,
    });

    return {
      ok: false,
      status,
      data,
      error: errorMessage,
    };
  }
}

module.exports = { sendEmailHttp };