const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const startedAt = process.uptime(); // segundos
    const dbResult = await db.query("SELECT 1 AS ok");

    return res.json({
      status: "ok",
      uptime_seconds: Math.round(startedAt),
      db: dbResult.rows[0].ok === 1 ? "ok" : "error",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /api/health error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
