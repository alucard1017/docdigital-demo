// backend/controllers/templates/templatesController.js
const db = require("../../db");
const { logAudit } = require("../../utils/auditLog");

/**
 * GET /api/templates
 * Obtener plantillas de la empresa
 */
async function getTemplates(req, res) {
  try {
    const companyId = req.user.company_id;

    const result = await db.query(
      `SELECT * FROM document_templates
       WHERE company_id = $1 AND active = true
       ORDER BY created_at DESC`,
      [companyId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo plantillas:", err);
    return res.status(500).json({ message: "Error obteniendo plantillas" });
  }
}

/**
 * POST /api/templates
 * Crear plantilla
 */
async function createTemplate(req, res) {
  try {
    const {
      name,
      description,
      tipo,
      categoria_firma,
      tipo_flujo,
      firmantes_default,
      requires_visado,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    const result = await db.query(
      `INSERT INTO document_templates (
         company_id,
         name,
         description,
         tipo,
         categoria_firma,
         tipo_flujo,
         firmantes_default,
         requires_visado,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.company_id,
        name,
        description || null,
        tipo || null,
        categoria_firma || "SIMPLE",
        tipo_flujo || "SECUENCIAL",
        firmantes_default ? JSON.stringify(firmantes_default) : null,
        requires_visado || false,
        req.user.id,
      ]
    );

    await logAudit({
      user: req.user,
      action: "TEMPLATE_CREATED",
      entityType: "template",
      entityId: result.rows[0].id,
      metadata: { name },
      req,
    });

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creando plantilla:", err);
    return res.status(500).json({ message: "Error creando plantilla" });
  }
}

/**
 * DELETE /api/templates/:id
 * Eliminar plantilla (soft delete)
 */
async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE document_templates
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [id, req.user.company_id]
    );

    await logAudit({
      user: req.user,
      action: "TEMPLATE_DELETED",
      entityType: "template",
      entityId: Number(id),
      metadata: {},
      req,
    });

    return res.json({ message: "Plantilla eliminada" });
  } catch (err) {
    console.error("❌ Error eliminando plantilla:", err);
    return res.status(500).json({ message: "Error eliminando plantilla" });
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  deleteTemplate,
};
