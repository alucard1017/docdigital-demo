// backend/utils/auditoria.js
const db = require("../db");

async function registrarAuditoria({
  documento_id,
  usuario_id,
  evento_tipo,
  descripcion,
  ip_address,
  user_agent,
}) {
  try {
    await db.query(
      `INSERT INTO auditoria_documentos (
         documento_id,
         usuario_id,
         evento_tipo,
         descripcion,
         ip_address,
         user_agent,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        documento_id,
        usuario_id,
        evento_tipo,
        descripcion,
        ip_address,
        user_agent,
      ]
    );
  } catch (err) {
    console.error("❌ Error en registrarAuditoria:", err);
  }
}

module.exports = { registrarAuditoria };
