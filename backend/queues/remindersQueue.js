// backend/queues/remindersQueue.js
const { Queue } = require("bullmq");
const Redis = require("ioredis");

const ENABLE_REMINDERS_QUEUE =
  String(process.env.ENABLE_REMINDERS_QUEUE || "true")
    .toLowerCase() === "true";

function createRedisConnection(label) {
  if (!ENABLE_REMINDERS_QUEUE) {
    console.warn(
      `ℹ️ [${label}] Cola de recordatorios deshabilitada (ENABLE_REMINDERS_QUEUE=false)`
    );
    return null;
  }

  let connection;

  const baseOptions = {
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT || 15000),
    maxRetriesPerRequest: null, // dejar que BullMQ maneje sus propios retries
    retryStrategy(times) {
      const delay = Math.min(times * 1000, 15000);
      return delay;
    },
  };

  if (process.env.REDIS_URL) {
    connection = new Redis(process.env.REDIS_URL, baseOptions);

    connection.on("error", (err) => {
      console.error(`⚠️ [${label}] Error en Redis:`, err.message);
    });

    connection.on("end", () => {
      console.warn(`⚠️ [${label}] Conexión Redis cerrada`);
    });

    console.log(`✅ [${label}] Usando REDIS_URL (Redis Cloud)`);
  } else {
    connection = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      ...baseOptions,
    });

    connection.on("error", (err) => {
      console.error(`⚠️ [${label}] Error en Redis:`, err.message);
    });

    connection.on("end", () => {
      console.warn(`⚠️ [${label}] Conexión Redis cerrada`);
    });

    console.log(`⚠️ [${label}] Usando config manual de Redis`);
  }

  return connection;
}

const connection = createRedisConnection("REMINDERS_QUEUE");

let remindersQueue;

if (!connection) {
  // Stub de cola deshabilitada
  remindersQueue = {
    add: async (name, data, opts) => {
      console.log(
        "ℹ️ [REMINDERS_QUEUE] add() llamado pero la cola está deshabilitada.",
        { name, data }
      );
    },
    on: () => {},
  };
} else {
  remindersQueue = new Queue("document-reminders", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  remindersQueue.on("error", (err) => {
    console.error("❌ [REMINDERS_QUEUE] Error en queue:", err.message);
  });
}

module.exports = remindersQueue;