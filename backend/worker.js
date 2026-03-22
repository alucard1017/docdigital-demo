require("dotenv").config({ path: ".env" });
require("./instrument");

const worker = require("./queues/remindersWorker");

console.log("✅ Worker de recordatorios iniciado en proceso separado");

process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM recibido, cerrando worker...");
  process.exit(0);
});
