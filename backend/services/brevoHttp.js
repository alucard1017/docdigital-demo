// backend/services/brevoHttp.js
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL || "verifirma.cl@gmail.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "VeriFirma";

async function sendEmailHttp({ to, subject, html, headers = {} }) {
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

  try {
    const payload = {
      sender: {
        email: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email: to,
        },
      ],
      subject,
      htmlContent: html,
      headers,
    };

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