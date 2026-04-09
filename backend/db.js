// backend/db.js - conexión a PostgreSQL (local y producción)
const { Pool } = require("pg");

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Usa siempre DATABASE_URL (Render u otro)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL no está definido. Revisa tu .env del backend");
  throw new Error("DATABASE_URL no definido");
}

// SSL: en Render normalmente necesitas SSL; en local puedes desactivarlo
// DB_SSL=true -> { rejectUnauthorized: false } (Render / servicios gestionados)
// DB_SSL=false o no definido -> sin SSL (local)
const sslEnabled =
  process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;

// Sanitizar para log (evitar credenciales y espacios raros)
let sanitizedConnectionString = connectionString;
try {
  sanitizedConnectionString = connectionString.replace(
    /:\/\/.*@(.+?)\//,
    "://***@$1/"
  );
} catch {
  // si falla el replace, dejamos el original sin tocar
}

console.log("🔌 Configuración PostgreSQL:", {
  NODE_ENV,
  connectionStringHost: sanitizedConnectionString,
  ssl: sslEnabled ? "enabled" : "disabled",
});

const pool = new Pool({
  connectionString,
  ssl: sslEnabled,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
});

// Log de errores del pool
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err);
});

// Test inicial de conexión (no bloqueante) + info de DB real
pool
  .query(
    "SELECT current_database(), inet_server_addr()::text AS host, inet_server_port() AS port"
  )
  .then((r) => {
    const info = r.rows[0];
    console.log(
      `✅ Conexión a PostgreSQL OK → db=${info.current_database}, host=${info.host}, port=${info.port}`
    );
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