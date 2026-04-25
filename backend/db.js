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
    return String(value).replace(
      /:\/\/([^:@/]+)(?::[^@/]*)?@/,
      "://***:***@"
    );
  } catch {
    return value;
  }
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveSslConfig() {
  const raw = String(process.env.DB_SSL || "").toLowerCase().trim();

  if (["false", "0", "off", "disabled", "no"].includes(raw)) return false;
  if (["true", "1", "on", "enabled", "yes"].includes(raw)) {
    return { rejectUnauthorized: false };
  }

  return isProd ? { rejectUnauthorized: false } : false;
}

function resolveHostFromUrl(value = "") {
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname?.replace(/^\//, "") || "",
      username: url.username || "",
    };
  } catch {
    return {
      protocol: "unknown",
      host: "unknown",
      port: "unknown",
      database: "unknown",
      username: "",
    };
  }
}

const ssl = resolveSslConfig();

const poolConfig = {
  connectionString,
  ssl,
  max: toNumber(process.env.DB_POOL_MAX, 10),
  min: toNumber(process.env.DB_POOL_MIN, 0),
  idleTimeoutMillis: toNumber(process.env.DB_IDLE_TIMEOUT, 30000),
  // subimos bastante el timeout por conexión para dev
  connectionTimeoutMillis: toNumber(
    process.env.DB_CONNECT_TIMEOUT,
    isProd ? 10000 : 30000
  ),
  keepAlive: true,
  keepAliveInitialDelayMillis: toNumber(
    process.env.DB_KEEPALIVE_INITIAL_DELAY,
    10000
  ),
  allowExitOnIdle: false,
};

const maxLifetimeSeconds = toNumber(
  process.env.DB_MAX_LIFETIME_SECONDS,
  isProd ? 300 : 0
);

if (maxLifetimeSeconds > 0) {
  poolConfig.maxLifetimeSeconds = maxLifetimeSeconds;
}

const parsedConn = resolveHostFromUrl(connectionString);

console.log("🔌 Configuración PostgreSQL:", {
  NODE_ENV,
  connectionStringHost: sanitizeConnectionString(connectionString),
  protocol: parsedConn.protocol,
  host: parsedConn.host,
  port: parsedConn.port,
  database: parsedConn.database,
  ssl: ssl ? "enabled" : "disabled",
  max: poolConfig.max,
  min: poolConfig.min,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  keepAlive: poolConfig.keepAlive,
  keepAliveInitialDelayMillis: poolConfig.keepAliveInitialDelayMillis,
  maxLifetimeSeconds: poolConfig.maxLifetimeSeconds || 0,
});

const pool = new Pool(poolConfig);

pool.on("connect", (client) => {
  client
    .query("SET statement_timeout TO 30000")
    .then(() =>
      client.query("SET idle_in_transaction_session_timeout TO 30000")
    )
    .catch((err) => {
      console.warn(
        "⚠️ No se pudieron aplicar timeouts de sesión:",
        err.message
      );
    });
});

pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", {
    message: err.message,
    code: err.code || null,
    name: err.name || null,
  });
});

async function testConnection() {
  const startedAt = Date.now();

  try {
    const { rows } = await pool.query(`
      SELECT
        current_database() AS db,
        current_user AS current_user,
        inet_server_addr()::text AS host,
        inet_server_port() AS port,
        now() AS server_time
    `);

    const duration = Date.now() - startedAt;
    const info = rows[0];

    console.log("✅ Conexión a PostgreSQL OK:", {
      db: info.db,
      currentUser: info.current_user,
      host: info.host || parsedConn.host,
      port: info.port || parsedConn.port,
      serverTime: info.server_time,
      durationMs: duration,
    });
  } catch (err) {
    const duration = Date.now() - startedAt;

    console.error("❌ No se pudo conectar a PostgreSQL:", {
      message: err.message,
      code: err.code || null,
      durationMs: duration,
      host: parsedConn.host,
      port: parsedConn.port,
      database: parsedConn.database,
      ssl: ssl ? "enabled" : "disabled",
    });

    if (!isProd) {
      console.error(err);
      console.error(
        "🧭 Diagnóstico rápido: verifica que PostgreSQL esté encendido, escuchando en el puerto configurado y que DATABASE_URL tenga usuario/clave/DB correctos."
      );
      // EN DEV: no matamos el proceso
    } else {
      console.error("⛔ En producción, fallo crítico de conexión a DB");
    }
  }
}

// Lanzamos el test SOLO fuera de desarrollo
if (NODE_ENV === "development") {
  console.log("ℹ️ Saltando testConnection de PostgreSQL en desarrollo");
} else {
  void testConnection();
}

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
      code: err.code || null,
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