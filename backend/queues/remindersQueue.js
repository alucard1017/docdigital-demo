// backend/queues/remindersQueue.js
const { Queue } = require("bullmq");
const Redis = require("ioredis");

let connection;

if (process.env.REDIS_URL) {
  // Crear instancia de ioredis desde la URL
  connection = new Redis(process.env.REDIS_URL);
  console.log("✓ Queue usando REDIS_URL (Redis Cloud)");
} else {
  // Fallback a config manual (dev local)
  connection = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  console.log("⚠️ Queue usando config manual de Redis");
}

const remindersQueue = new Queue("document-reminders", { connection });

remindersQueue.on("error", (err) => {
  console.error("❌ Error en remindersQueue:", err.message);
});

module.exports = remindersQueue;
