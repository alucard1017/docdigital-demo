/* ================================
   RUTAS DE MÉTRICAS
   ================================ */
const express = require("express");
const router = express.Router();

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeString(value, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * POST /api/metrics/web-vitals
 * Recibe métricas de rendimiento del frontend (Web Vitals)
 */
router.post("/web-vitals", async (req, res) => {
  try {
    const body = req.body || {};

    const name = safeString(body.name);
    const value = safeNumber(body.value);
    const rating = safeString(body.rating, "unrated");
    const path = safeString(body.path, "/");
    const timestamp = body.timestamp || new Date().toISOString();
    const delta = safeNumber(body.delta);
    const id = safeString(body.id, "no-id");
    const navigationType = safeString(body.navigationType, "unknown");

    const printableValue = value !== null ? value.toFixed(2) : "N/A";
    const printableDelta = delta !== null ? delta.toFixed(2) : "N/A";

    console.log(
      `[WEB_VITALS] ${name}: ${printableValue}ms (${rating}) - ${path} at ${timestamp} | delta=${printableDelta} | nav=${navigationType} | id=${id}`
    );

    // TODO: Opcional - guardar en DB si quieres histórico
    // await db.query(
    //   `INSERT INTO metrics (name, value, rating, path, timestamp, delta, metric_id, navigation_type)
    //    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    //   [name, value, rating, path, timestamp, delta, id, navigationType]
    // );

    return res.status(204).end();
  } catch (error) {
    console.error("[WEB_VITALS] Error procesando métrica:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo procesar la métrica web-vitals.",
    });
  }
});

module.exports = router;