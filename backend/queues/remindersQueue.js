const { Queue } = require("bullmq");
const Redis = require("ioredis");

let connection;

if (process.env.REDIS_URL) {
  connection = new Redis(process.env.REDIS_URL, {
    connectTimeout: 10000,        // 10s
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // reintentos espaciados, pero sin bucles locos
      const delay = Math.min(times * 1000, 15000);
      return delay;
    },
  });

  connection.on("error", (err) => {
    console.error("⚠️ Error en Redis:", err.message);
  });

  console.log("✓ Queue usando REDIS_URL (Redis Cloud)");
} else {
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
