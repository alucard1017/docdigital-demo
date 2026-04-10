// backend/db.js - conexión robusta a PostgreSQL (local y producción)
const { Pool } = require("pg");

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL no está definido. Revisa tu .env del backend");
  throw new Error("DATABASE_URL no definido");
}

/**
 * SSL
 * - En Render / producción normalmente necesitas SSL
 * - DB_SSL=true fuerza SSL
 * - DB_SSL=false lo desactiva explícitamente
 * - Si no viene definido, en producción lo activamos automáticamente
 */
function resolveSslConfig() {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_SSL === "true") {
    return { rejectUnauthorized: false };
  }
  if (isProd) {
    return { rejectUnauthorized: false };
  }
  return false;
}

const ssl = resolveSslConfig();

/**
 * Sanitizar para log
 */
function sanitizeConnectionString(value = "") {
  try {
    return String(value).replace(/:\/\/.*@(.+?)\//, "://***@$1/");
  } catch {
    return value;
  }
}

const sanitizedConnectionString = sanitizeConnectionString(connectionString);

const poolConfig = {
  connectionString,
  ssl,
  max: Number(process.env.DB_POOL_MAX || 10),
  min: Number(process.env.DB_POOL_MIN || 0),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  allowExitOnIdle: false,
  maxLifetimeSeconds: Number(process.env.DB_MAX_LIFETIME_SECONDS || 60),
};

console.log("🔌 Configuración PostgreSQL:", {
  NODE_ENV,
  connectionStringHost: sanitizedConnectionString,
  ssl: ssl ? "enabled" : "disabled",
  max: poolConfig.max,
  min: poolConfig.min,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  maxLifetimeSeconds: poolConfig.maxLifetimeSeconds,
});

const pool = new Pool(poolConfig);

/**
 * Hook al conectar un cliente nuevo
 */
pool.on("connect", async (client) => {
  try {
    await client.query("SET statement_timeout TO 30000");
    await client.query("SET idle_in_transaction_session_timeout TO 30000");
  } catch (err) {
    console.warn("⚠️ No se pudieron aplicar timeouts de sesión:", err.message);
  }
});

/**
 * Errores inesperados del pool
 */
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err);
});

/**
 * Test inicial de conexión (no bloqueante)
 */
(async () => {
  try {
    const r = await pool.query(
      `
      SELECT
        current_database() AS db,
        inet_server_addr()::text AS host,
        inet_server_port() AS port,
        now() AS server_time
      `
    );

    const info = r.rows[0];
    console.log(
      `✅ Conexión a PostgreSQL OK → db=${info.db}, host=${info.host}, port=${info.port}, server_time=${info.server_time}`
    );
  } catch (err) {
    console.error("❌ No se pudo conectar a PostgreSQL:", err.message);
    if (!isProd) {
      console.error(err);
    }
  }
})();

/**
 * Wrapper query con timing
 */
async function query(text, params) {
  const startedAt = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - startedAt;

    if (duration > 2000) {
      console.warn("⚠️ Query lenta detectada:", {
        durationMs: duration,
        rowCount: result.rowCount,
        text:
          typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "unknown",
      });
    }

    return result;
  } catch (err) {
    const duration = Date.now() - startedAt;
    console.error("❌ Error en query PostgreSQL:", {
      durationMs: duration,
      message: err.message,
      text:
        typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "unknown",
    });
    throw err;
  }
}

/**
 * Obtener cliente para transacciones manuales
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = {
  query,
  getClient,
  pool,
};