const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("./auth");
const { logAudit } = require("../utils/auditLog");

const router = express.Router();

/**
 * GET /api/companies
 * Lista de empresas (solo admins)
 */
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name
       FROM public.companies
       ORDER BY name ASC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error en GET /api/companies:", err);
    return res
      .status(500)
      .json({ message: "Error obteniendo listado de empresas" });
  }
});

/**
 * GET /api/companies/:id
 * Obtener empresa por id (solo admins)
 */
router.get("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, name
       FROM public.companies
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Empresa no encontrada" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error en GET /api/companies/:id:", err);
    return res
      .status(500)
      .json({ message: "Error obteniendo empresa" });
  }
});

/**
 * POST /api/companies
 * Crear empresa (solo SUPER_ADMIN o ADMIN_GLOBAL)
 */
router.post("/", requireAuth, requireRole("ADMIN_GLOBAL"), async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ message: "El nombre de la empresa es obligatorio" });
    }

    const result = await db.query(
      `INSERT INTO public.companies (name)
       VALUES ($1)
       RETURNING id, name`,
      [name.trim()]
    );

    const company = result.rows[0];

    await logAudit({
      user: req.user,
      action: "company_created",
      entityType: "company",
      entityId: company.id,
      metadata: {
        name: company.name,
      },
      req,
    });

    return res.status(201).json(company);
  } catch (err) {
    console.error("❌ Error en POST /api/companies:", err);
    return res
      .status(500)
      .json({ message: "Error al crear la empresa" });
  }
});

/**
 * PUT /api/companies/:id
 * Editar nombre de empresa (solo SUPER_ADMIN o ADMIN_GLOBAL)
 */
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN_GLOBAL"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body || {};

      if (!name || !name.trim()) {
        return res
          .status(400)
          .json({ message: "El nombre de la empresa es obligatorio" });
      }

      const beforeRes = await db.query(
        `SELECT id, name
         FROM public.companies
         WHERE id = $1`,
        [id]
      );

      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }

      const before = beforeRes.rows[0];

      const result = await db.query(
        `UPDATE public.companies
         SET name = $1
         WHERE id = $2
         RETURNING id, name`,
        [name.trim(), id]
      );

      const company = result.rows[0];

      await logAudit({
        user: req.user,
        action: "company_updated",
        entityType: "company",
        entityId: company.id,
        metadata: {
          old_name: before.name,
          new_name: company.name,
        },
        req,
      });

      return res.json(company);
    } catch (err) {
      console.error("❌ Error en PUT /api/companies/:id:", err);
      return res
        .status(500)
        .json({ message: "Error al actualizar la empresa" });
    }
  }
);

/**
 * DELETE /api/companies/:id
 * Eliminar empresa (solo SUPER_ADMIN)
 * OJO: solo si no tiene usuarios asociados.
 */
router.delete(
  "/:id",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const usersResult = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM public.users
         WHERE company_id = $1`,
        [id]
      );

      if (usersResult.rows[0].total > 0) {
        return res.status(400).json({
          message:
            "No puedes eliminar una empresa que tiene usuarios asociados",
        });
      }

      const result = await db.query(
        `DELETE FROM public.companies
         WHERE id = $1
         RETURNING id, name`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }

      const deleted = result.rows[0];

      await logAudit({
        user: req.user,
        action: "company_deleted",
        entityType: "company",
        entityId: deleted.id,
        metadata: {
          name: deleted.name,
        },
        req,
      });

      return res.json({
        message: "Empresa eliminada correctamente",
        company: deleted,
      });
    } catch (err) {
      console.error("❌ Error en DELETE /api/companies/:id:", err);
      return res
        .status(500)
        .json({ message: "Error al eliminar la empresa" });
    }
  }
);

module.exports = router;