/* ================================
   RUTAS DE MÉTRICAS
   ================================ */
const express = require('express');
const router = express.Router();

/**
 * POST /api/metrics/web-vitals
 * Recibe métricas de rendimiento del frontend (Web Vitals)
 */
router.post('/web-vitals', (req, res) => {
  const { name, value, rating, path, timestamp } = req.body;
  
  // Log estructurado para análisis posterior
  console.log(`[WEB_VITALS] ${name}: ${value.toFixed(2)}ms (${rating}) - ${path} at ${timestamp}`);
  
  // TODO: Opcional - guardar en tabla metrics para análisis histórico
  // await db.query(
  //   'INSERT INTO metrics (name, value, rating, path, timestamp) VALUES ($1, $2, $3, $4, $5)',
  //   [name, value, rating, path, timestamp]
  // );
  
  res.status(204).end();
});

module.exports = router;