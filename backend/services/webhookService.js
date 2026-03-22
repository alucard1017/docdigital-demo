// backend/services/webhookService.js
const axios = require("axios");
const db = require("../db");

/**
 * Disparar webhook a URL configurada por empresa
 */
async function triggerWebhook(companyId, event, payload) {
  try {
    // Obtener webhook URL de la empresa
    const webhookRes = await db.query(
      `SELECT webhook_url, webhook_secret, webhook_enabled
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (webhookRes.rowCount === 0) return;

    const { webhook_url, webhook_secret, webhook_enabled } = webhookRes.rows[0];

    if (!webhook_enabled || !webhook_url) {
      console.log(`⏭️ Webhook deshabilitado para company ${companyId}`);
      return;
    }

    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const headers = {
      "Content-Type": "application/json",
      "X-VeriFirma-Event": event,
    };

    if (webhook_secret) {
      const crypto = require("crypto");
      const signature = crypto
        .createHmac("sha256", webhook_secret)
        .update(JSON.stringify(webhookPayload))
        .digest("hex");
      headers["X-VeriFirma-Signature"] = signature;
    }

    const response = await axios.post(webhook_url, webhookPayload, {
      headers,
      timeout: 5000,
    });

    console.log(`✅ Webhook enviado a ${webhook_url} (evento: ${event})`);

    // Log del webhook
    await db.query(
      `INSERT INTO webhook_logs (
         company_id,
         event,
         payload,
         response_status,
         created_at
       )
       VALUES ($1, $2, $3, $4, NOW())`,
      [companyId, event, JSON.stringify(webhookPayload), response.status]
    );
  } catch (err) {
    console.error(`❌ Error enviando webhook (evento: ${event}):`, err.message);

    // Log del error
    await db.query(
      `INSERT INTO webhook_logs (
         company_id,
         event,
         payload,
         response_status,
         error_message,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        companyId,
        event,
        JSON.stringify(payload),
        err.response?.status || null,
        err.message,
      ]
    );
  }
}

/**
 * Eventos disponibles:
 * - document.sent
 * - document.signed
 * - document.rejected
 * - reminder.sent
 */

module.exports = {
  triggerWebhook,
};
