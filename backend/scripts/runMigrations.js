// backend/scripts/runMigrations.js
const db = require("../db");

async function runMigrations() {
  try {
    console.log("🔄 Ejecutando migraciones en producción...");

    await db.query(`
      ALTER TABLE document_signers
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);

    console.log("✅ Migración document_signers completada");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_signers_rejected 
      ON document_signers(document_id, status) 
      WHERE status = 'RECHAZADO';
    `);

    console.log("✅ Índice idx_signers_rejected creado");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error en migración:", err);
    process.exit(1);
  }
}

runMigrations();
