// backend/queues/remindersQueue.js
const { Queue } = require("bullmq");
const Redis = require("ioredis");

function createRedisConnection(label) {
  let connection;

  if (process.env.REDIS_URL) {
    connection = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        const delay = Math.min(times * 1000, 15000);
        return delay;
      },
    });

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
      connectTimeout: 10000,
      maxRetriesPerRequest: 1,
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

const remindersQueue = new Queue("document-reminders", {
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

module.exports = remindersQueue;