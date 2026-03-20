// backend/services/brevoHttp.js
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "verifirma.cl@gmail.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "VeriFirma";

async function sendEmailHttp({ to, subject, html }) {
  if (!BREVO_API_KEY || !SENDER_EMAIL) {
    console.error("❌ [BREVO HTTP] Falta BREVO_API_KEY o SENDER_EMAIL");
    return false;
  }

  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ [BREVO HTTP] Enviado:", res.data);
    return true;
  } catch (err) {
    console.error(
      "❌ [BREVO HTTP] Error:",
      err.response?.data || err.message
    );
    return false;
  }
}

module.exports = { sendEmailHttp };
