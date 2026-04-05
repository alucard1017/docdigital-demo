// backend/queues/remindersWorker.js
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const {
  sendAutomaticReminders,
} = require("../controllers/documents/reminders");

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

const connection = createRedisConnection("REMINDERS_WORKER");

const worker = new Worker(
  "document-reminders",
  async (job) => {
    const { userId } = job.data || {};
    console.log(`▶️ [REMINDERS_WORKER] Job recordatorios userId=${userId}`);

    const fakeReq = { user: { id: userId } };
    const fakeRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        console.log(
          "✅ [REMINDERS_WORKER] sendAutomaticReminders:",
          JSON.stringify(body)
        );
      },
    };

    await sendAutomaticReminders(fakeReq, fakeRes);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ [REMINDERS_WORKER] Job completado (id=${job.id})`);
});

worker.on("failed", (job, err) => {
  console.error(
    `❌ [REMINDERS_WORKER] Job falló (id=${job?.id}):`,
    err.message
  );
});

worker.on("error", (err) => {
  console.error("❌ [REMINDERS_WORKER] Error en worker:", err.message);
});

module.exports = worker;