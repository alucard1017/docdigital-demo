// backend/controllers/admin/restoreController.js
const db = require("../../db");
const { logAudit } = require("../../utils/auditLog");

/**
 * POST /api/admin/restore/:type/:id
 * Restaurar elemento eliminado (soft delete)
 */
async function restoreEntity(req, res) {
  try {
    const { type, id } = req.params;

    let tableName;
    switch (type) {
      case "user":
        tableName = "users";
        break;
      case "company":
        tableName = "companies";
        break;
      case "document":
        tableName = "documentos";
        break;
      default:
        return res.status(400).json({ message: "Tipo inválido" });
    }

    const result = await db.query(
      `UPDATE ${tableName}
       SET deleted_at = NULL
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Elemento no encontrado o no estaba eliminado",
      });
    }

    await logAudit({
      user: req.user,
      action: "ENTITY_RESTORED",
      entityType: type,
      entityId: Number(id),
      metadata: { table: tableName },
      req,
    });

    return res.json({
      message: "Elemento restaurado exitosamente",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error restaurando:", err);
    return res.status(500).json({ message: "Error restaurando elemento" });
  }
}

/**
 * GET /api/admin/deleted/:type
 * Ver elementos eliminados
 */
async function getDeletedEntities(req, res) {
  try {
    const { type } = req.params;

    let tableName;
    switch (type) {
      case "users":
        tableName = "users";
        break;
      case "companies":
        tableName = "companies";
        break;
      case "documents":
        tableName = "documentos";
        break;
      default:
        return res.status(400).json({ message: "Tipo inválido" });
    }

    const result = await db.query(
      `SELECT * FROM ${tableName}
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC
       LIMIT 100`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo eliminados:", err);
    return res.status(500).json({ message: "Error obteniendo elementos" });
  }
}

module.exports = {
  restoreEntity,
  getDeletedEntities,
};
