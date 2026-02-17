// backend/utils/auditLog.js
const db = require('../db');

/**
 * Registra un evento de auditoría en la tabla auditoria_documentos
 * @param {Object} params
 * @param {number} params.documento_id - ID del documento
 * @param {number} params.usuario_id - ID del usuario que hizo la acción
 * @param {string} params.evento_tipo - Tipo de evento (CREADO, FIRMADO, RECHAZADO, etc.)
 * @param {string} params.descripcion - Descripción del evento
 * @param {string} params.ip_address - IP del usuario (opcional)
 * @param {string} params.user_agent - User Agent del navegador (opcional)
 */
async function registrarAuditoria({
  documento_id,
  usuario_id,
  evento_tipo,
  descripcion,
  ip_address = null,
  user_agent = null,
}) {
  try {
    await db.query(
      `INSERT INTO auditoria_documentos (
         documento_id, usuario_id, evento_tipo, descripcion, ip_address, user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [documento_id, usuario_id, evento_tipo, descripcion, ip_address, user_agent]
    );
    console.log(`✅ Auditoría registrada: ${evento_tipo} para documento ${documento_id}`);
  } catch (err) {
    console.error('⚠️ Error registrando auditoría:', err.message);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Obtiene el historial de auditoría de un documento
 */
async function obtenerAuditoria(documento_id) {
  try {
    const result = await db.query(
      `SELECT * FROM auditoria_documentos
       WHERE documento_id = $1
       ORDER BY created_at DESC`,
      [documento_id]
    );
    return result.rows;
  } catch (err) {
    console.error('⚠️ Error obteniendo auditoría:', err.message);
    return [];
  }
}

module.exports = { registrarAuditoria, obtenerAuditoria };
