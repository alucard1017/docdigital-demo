// backend/queues/remindersWorker.js
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const {
  sendAutomaticReminders,
} = require("../controllers/documents/reminders");

let connection;

if (process.env.REDIS_URL) {
  connection = new Redis(process.env.REDIS_URL);
  console.log("✓ Worker usando REDIS_URL (Redis Cloud)");
} else {
  connection = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  console.log("⚠️ Worker usando config manual de Redis");
}

const worker = new Worker(
  "document-reminders",
  async (job) => {
    const { userId } = job.data;
    console.log(`▶️ Procesando job recordatorios para userId=${userId}`);

    const fakeReq = { user: { id: userId } };
    const fakeRes = {
      statusCode: 200,
      json: (body) => {
        console.log(
          "✅ sendAutomaticReminders ejecutado desde worker:",
          JSON.stringify(body)
        );
      },
    };

    await sendAutomaticReminders(fakeReq, fakeRes);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job recordatorios completado (id=${job.id})`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job recordatorios falló (id=${job?.id}):`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ Error en worker:", err.message);
});

module.exports = worker;
