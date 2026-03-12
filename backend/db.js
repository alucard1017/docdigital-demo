// backend/db.js - conexión a PostgreSQL “pro”
const { Pool } = require("pg");

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Usa siempre DATABASE_URL (Render u otro)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL no está definido. Revisa tu .env del backend");
  throw new Error("DATABASE_URL no definido");
}

// SSL según DB_SSL (útil para Render / servicios gestionados)
const sslEnabled =
  process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false;

console.log("🔌 Configuración PostgreSQL:", {
  NODE_ENV,
  hasConnectionString: !!connectionString,
  ssl: sslEnabled ? "enabled" : "disabled",
});

const pool = new Pool({
  connectionString,
  ssl: sslEnabled,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
});

// Log de errores del pool
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err);
});

// Test inicial de conexión (no bloqueante)
pool
  .query("SELECT 1")
  .then(() => {
    console.log("✅ Conexión a PostgreSQL OK");
  })
  .catch((err) => {
    console.error("❌ No se pudo conectar a PostgreSQL:", err.message);
    if (!isProd) {
      console.error(err);
    }
  });

// Wrapper para usar pool.query en todo el proyecto
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool, // por si luego necesitas transacciones/migraciones
};
