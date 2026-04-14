// backend/db.js
const { Pool } = require("pg");

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL no está definido. Revisa tu .env del backend");
  throw new Error("DATABASE_URL no definido");
}

function sanitizeConnectionString(value = "") {
  try {
    return String(value).replace(/:\/\/([^:@/]+)(?::[^@/]*)?@/, "://***:***@");
  } catch {
    return value;
  }
}

function resolveSslConfig() {
  const raw = String(process.env.DB_SSL || "").toLowerCase().trim();

  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") {
    return { rejectUnauthorized: false };
  }

  if (isProd) {
    return { rejectUnauthorized: false };
  }

  return false;
}

const ssl = resolveSslConfig();

const poolConfig = {
  connectionString,
  ssl,
  max: Number(process.env.DB_POOL_MAX || 10),
  min: Number(process.env.DB_POOL_MIN || 0),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 15000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  allowExitOnIdle: false,
  maxLifetimeSeconds: Number(process.env.DB_MAX_LIFETIME_SECONDS || 60),
};

console.log("🔌 Configuración PostgreSQL:", {
  NODE_ENV,
  connectionStringHost: sanitizeConnectionString(connectionString),
  ssl: ssl ? "enabled" : "disabled",
  max: poolConfig.max,
  min: poolConfig.min,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  maxLifetimeSeconds: poolConfig.maxLifetimeSeconds,
});

const pool = new Pool(poolConfig);

pool.on("connect", (client) => {
  client
    .query("SET statement_timeout TO 30000")
    .then(() => client.query("SET idle_in_transaction_session_timeout TO 30000"))
    .catch((err) => {
      console.warn("⚠️ No se pudieron aplicar timeouts de sesión:", err.message);
    });
});

pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err.message);
});

async function testConnection() {
  try {
    const { rows } = await pool.query(`
      SELECT
        current_database() AS db,
        inet_server_addr()::text AS host,
        inet_server_port() AS port,
        now() AS server_time
    `);

    const info = rows[0];
    console.log(
      `✅ Conexión a PostgreSQL OK → db=${info.db}, host=${info.host}, port=${info.port}, server_time=${info.server_time}`
    );
  } catch (err) {
    console.error("❌ No se pudo conectar a PostgreSQL:", err.message);
    if (!isProd) console.error(err);
  }
}

void testConnection();

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
          typeof text === "string"
            ? text.replace(/\s+/g, " ").trim()
            : "unknown",
      });
    }

    return result;
  } catch (err) {
    const duration = Date.now() - startedAt;
    console.error("❌ Error en query PostgreSQL:", {
      durationMs: duration,
      message: err.message,
      text:
        typeof text === "string"
          ? text.replace(/\s+/g, " ").trim()
          : "unknown",
    });
    throw err;
  }
}

async function getClient() {
  return pool.connect();
}

module.exports = {
  query,
  getClient,
  pool,
};