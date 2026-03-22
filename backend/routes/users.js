// backend/routes/users.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireRole } = require("./auth");
const { logAuth, logAudit } = require("../utils/auditLog");
const {
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/users/profileController");

const router = express.Router();

// Normalizar RUN: quitar puntos y guiones
const normalizeRun = (run) => (run || "").replace(/[.\-]/g, "");

// RUN del dueño que NUNCA se puede borrar ni tocar salvo él mismo
const OWNER_RUN = normalizeRun(process.env.ADMIN_RUN || "1053806586");

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN_GLOBAL", "ADMIN", "USER"];

function isAdminLike(role) {
  return role === "ADMIN" || role === "ADMIN_GLOBAL" || role === "SUPER_ADMIN";
}

/* ================================
   RUTAS DE PERFIL (USUARIO ACTUAL)
   ================================ */

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     summary: Obtener perfil del usuario actual
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 */
router.get("/profile", requireAuth, getProfile);

/**
 * @openapi
 * /api/users/profile:
 *   put:
 *     summary: Actualizar perfil del usuario actual
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado
 */
router.put("/profile", requireAuth, updateProfile);

/**
 * @openapi
 * /api/users/change-password:
 *   post:
 *     summary: Cambiar contraseña del usuario actual
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 */
router.post("/change-password", requireAuth, changePassword);

/* ================================
   REGISTRO PÚBLICO
   ================================ */

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     summary: Registro público de usuarios
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               run:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               plan:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado
 */
router.post("/register", async (req, res, next) => {
  try {
    const { run, name, email, password, plan } = req.body || {};

    if (!run || !name || !email || !password) {
      return res
        .status(400)
        .json({ message: "RUN, nombre, correo y contraseña son obligatorios" });
    }

    const normalizedRun = normalizeRun(run);
    const normalizedEmail = String(email).toLowerCase();
    const hash = bcrypt.hashSync(password, 10);

    const result = await db.query(
      `INSERT INTO public.users (run, "name", email, password_hash, "plan", "role", active, company_id)
       VALUES ($1, $2, $3, $4, $5, 'USER', true, $6)
       RETURNING id, run, "name", email, company_id`,
      [normalizedRun, name, normalizedEmail, hash, plan || "basic", null]
    );

    const created = result.rows[0];

    await logAudit({
      user: null,
      action: "USER_REGISTERED_PUBLIC",
      entityType: "user",
      entityId: created.id,
      metadata: {
        run: created.run,
        email: created.email,
        plan: plan || "basic",
      },
      req,
    });

    return res.status(201).json({ message: "Usuario creado exitosamente" });
  } catch (err) {
    console.error("❌ Error en POST /api/users/register:", err);
    return next(err);
  }
});

/* ================================
   CRUD DE USUARIOS (ADMIN)
   ================================ */

/**
 * GET /api/users
 * Lista de usuarios según permisos
 */
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { role, company_id, run } = req.user;
    const { role: filterRole } = req.query;

    const params = [];
    const whereParts = [];

    const requesterRun = normalizeRun(run);
    const isOwner = requesterRun === OWNER_RUN;
    const isSuper = role === "SUPER_ADMIN";
    const isGlobal = role === "ADMIN_GLOBAL";

    if (!isSuper && !isGlobal) {
      whereParts.push(`company_id = $${params.length + 1}`);
      params.push(company_id);
    }

    if (!isOwner) {
      whereParts.push(`run <> $${params.length + 1}`);
      params.push(OWNER_RUN);
    }

    if (filterRole) {
      whereParts.push(`role = $${params.length + 1}`);
      params.push(filterRole);
    }

    let query = `
      SELECT id, run, "name", email, "plan", "role", active, company_id, email_verified, created_at
      FROM public.users
    `;

    if (whereParts.length > 0) {
      query += " WHERE " + whereParts.join(" AND ");
    }

    query += " ORDER BY id ASC";

    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error listando usuarios:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/**
 * POST /api/users
 * Crear usuario (solo admin)
 */
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      run,
      name,
      password,
      plan = "basic",
      role,
      email,
      active,
      company_id,
    } = req.body || {};

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: "RUN, nombre y contraseña son obligatorios" });
    }

    const requesterRun = normalizeRun(req.user.run);
    const requesterRole = req.user.role;
    const isOwner = requesterRun === OWNER_RUN;

    const normalizedRun = normalizeRun(run);
    const normalizedEmail = email ? String(email).toLowerCase() : null;
    const hash = bcrypt.hashSync(password, 10);

    const finalCompanyId = company_id || req.user.company_id;

    if (!finalCompanyId) {
      return res
        .status(400)
        .json({ message: "company_id es obligatorio para crear usuarios" });
    }

    const countRes = await db.query(
      "SELECT COUNT(*)::int AS total FROM public.users WHERE company_id = $1",
      [finalCompanyId]
    );
    const totalInCompany = countRes.rows[0].total;

    let finalRole = role || "USER";

    if (totalInCompany === 0) {
      finalRole = "ADMIN";
    } else {
      if (isOwner) {
        if (!ALLOWED_ROLES.includes(finalRole)) {
          finalRole = "USER";
        }
      } else if (requesterRole === "ADMIN_GLOBAL") {
        if (finalRole === "SUPER_ADMIN") {
          finalRole = "ADMIN";
        }
        if (!["ADMIN", "USER"].includes(finalRole)) {
          finalRole = "USER";
        }
      } else if (requesterRole === "ADMIN") {
        if (finalCompanyId !== req.user.company_id) {
          return res
            .status(403)
            .json({ message: "No puedes crear usuarios en otra empresa" });
        }
        if (!["ADMIN", "USER"].includes(finalRole)) {
          finalRole = "USER";
        }
      } else {
        finalRole = "USER";
      }
    }

    const finalActive = typeof active === "boolean" ? active : true;

    const result = await db.query(
      `INSERT INTO public.users (run, "name", email, password_hash, "plan", "role", active, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, run, "name", email, "plan", "role", active, company_id`,
      [
        normalizedRun,
        name,
        normalizedEmail,
        hash,
        plan,
        finalRole,
        finalActive,
        finalCompanyId,
      ]
    );

    const created = result.rows[0];

    await logAudit({
      user: req.user,
      action: "USER_CREATED",
      entityType: "user",
      entityId: created.id,
      metadata: {
        run: created.run,
        email: created.email,
        role: created.role,
        company_id: created.company_id,
      },
      req,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("❌ Error creando usuario:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/**
 * PUT /api/users/:id
 * Editar usuario (solo admin)
 */
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { run, name, email, plan, role, password, active, company_id } =
      req.body || {};

    const requesterRun = normalizeRun(req.user.run);
    const requesterRole = req.user.role;
    const isOwner = requesterRun === OWNER_RUN;

    const userRes = await db.query(
      "SELECT id, run, role, company_id FROM public.users WHERE id = $1",
      [id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const before = userRes.rows[0];
    const targetIsOwner = normalizeRun(before.run) === OWNER_RUN;

    if (targetIsOwner && !isOwner) {
      return res.status(403).json({
        message: "No tienes permisos para modificar la cuenta principal",
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (run) {
      fields.push(`run = $${idx++}`);
      values.push(normalizeRun(run));
    }
    if (name) {
      fields.push(`"name" = $${idx++}`);
      values.push(name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email ? String(email).toLowerCase() : null);
    }
    if (plan) {
      fields.push(`"plan" = $${idx++}`);
      values.push(plan);
    }

    if (role && !(targetIsOwner && !isOwner)) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      if (!isOwner) {
        if (role === "SUPER_ADMIN" || role === "ADMIN_GLOBAL") {
          return res.status(403).json({
            message:
              "Solo el dueño puede asignar roles ADMIN_GLOBAL o SUPER_ADMIN",
          });
        }

        if (requesterRole === "ADMIN" || requesterRole === "ADMIN_GLOBAL") {
          if (before.company_id !== req.user.company_id) {
            return res.status(403).json({
              message: "No puedes cambiar el rol de usuarios de otra empresa",
            });
          }

          if (!["ADMIN", "USER"].includes(role)) {
            return res.status(403).json({
              message: "Solo puedes asignar roles USER o ADMIN en tu empresa",
            });
          }
        }
      }

      fields.push(`"role" = $${idx++}`);
      values.push(role);
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (typeof active === "boolean") {
      fields.push(`active = $${idx++}`);
      values.push(active);
    }
    if (company_id !== undefined) {
      if (!isOwner) {
        return res.status(403).json({
          message: "Solo el dueño puede cambiar la empresa de un usuario",
        });
      }
      fields.push(`company_id = $${idx++}`);
      values.push(company_id);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE public.users
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING id, run, "name", email, "plan", "role", active, company_id, email_verified`,
      values
    );

    const updated = result.rows[0];

await logAudit({
  user: req.user,
  action: "USER_UPDATED",
  entityType: "user",
  entityId: updated.id,
  metadata: {
    before_role: before.role,
    new_role: updated.role,
    company_id: updated.company_id,
  },
  req,
});

    return res.json(updated);
  } catch (err) {
    console.error("❌ Error actualizando usuario:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/**
 * DELETE /api/users/:id
 * Borrar usuario según reglas de permisos
 */
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await db.query(
      "SELECT id, run, role, company_id FROM public.users WHERE id = $1",
      [id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const target = userRes.rows[0];

    const requester = req.user;
    const requesterRun = normalizeRun(requester.run);
    const isOwner = requesterRun === OWNER_RUN;
    const isSuper = requester.role === "SUPER_ADMIN";
    const isGlobal = requester.role === "ADMIN_GLOBAL";
    const isAdminEmpresa = requester.role === "ADMIN";

    if (normalizeRun(target.run) === OWNER_RUN) {
      return res.status(403).json({
        message: "No se puede eliminar la cuenta principal del sistema",
      });
    }

    const targetIsAdmin = isAdminLike(target.role);

    if (targetIsAdmin) {
      if (target.role === "SUPER_ADMIN" || target.role === "ADMIN_GLOBAL") {
        if (!isOwner && !isSuper) {
          return res.status(403).json({
            message:
              "Solo el dueño o super admin pueden eliminar super_admin o admin_global",
          });
        }
      } else if (target.role === "ADMIN") {
        if (!isOwner && !isSuper && !isGlobal) {
          return res.status(403).json({
            message:
              "Solo el dueño, super admin o admin global pueden eliminar administradores",
          });
        }
      }
    } else {
      if (isAdminEmpresa && !isOwner && !isSuper && !isGlobal) {
        if (
          !requester.company_id ||
          requester.company_id !== target.company_id
        ) {
          return res.status(403).json({
            message: "Solo puedes eliminar usuarios de tu empresa",
          });
        }
      }
    }

    await db.query("DELETE FROM public.users WHERE id = $1", [id]);

    await logAudit({
      user: requester,
      action: "USER_DELETED",
      entityType: "user",
      entityId: target.id,
      metadata: {
        run: target.run,
        role: target.role,
        company_id: target.company_id,
      },
      req,
    });

    return res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error eliminando usuario:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Reset password por admin
 */
router.post(
  "/:id/reset-password",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const requester = req.user;
      const requesterRunNorm = normalizeRun(requester.run);
      const isOwner = requesterRunNorm === OWNER_RUN;
      const isSuper = requester.role === "SUPER_ADMIN";
      const isGlobal = requester.role === "ADMIN_GLOBAL";
      const isAdmin = requester.role === "ADMIN";

      const userRes = await db.query(
        "SELECT id, run, role, email, name, company_id FROM public.users WHERE id = $1",
        [id]
      );

      if (userRes.rowCount === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const target = userRes.rows[0];
      const targetRunNorm = normalizeRun(target.run);
      const isTargetOwner = targetRunNorm === OWNER_RUN;
      const isTargetAdminLike = isAdminLike(target.role);

      if (isTargetOwner && !isOwner) {
        return res.status(403).json({
          message: "No puedes resetear la contraseña de la cuenta principal",
        });
      }

      if (isTargetAdminLike && !isOwner && !isSuper) {
        return res.status(403).json({
          message:
            "Solo el dueño o super admin pueden resetear contraseñas de administradores",
        });
      }

      if (isAdmin && !isOwner && !isSuper && !isGlobal) {
        if (
          !requester.company_id ||
          requester.company_id !== target.company_id
        ) {
          return res.status(403).json({
            message: "Solo puedes resetear contraseñas de usuarios de tu empresa",
          });
        }
      }

      const crypto = require("crypto");
      const tempPassword = crypto.randomBytes(4).toString("hex");
      const hash = await bcrypt.hash(tempPassword, 10);

      await db.query(
        "UPDATE public.users SET password_hash = $1 WHERE id = $2",
        [hash, target.id]
      );

      try {
        const {
          sendPasswordResetAdminEmail,
        } = require("../services/sendPasswordResetEmail");
        if (target.email) {
          await sendPasswordResetAdminEmail({
            to: target.email,
            name: target.name,
            tempPassword,
          });
        }
      } catch (mailErr) {
        console.error("⚠️ Error enviando email de reset:", mailErr.message);
      }

      await logAudit({
        user: requester,
        action: "PASSWORD_RESET_BY_ADMIN",
        entityType: "user",
        entityId: target.id,
        metadata: {
          target_run: target.run,
          target_role: target.role,
        },
        req,
      });

      return res.json({
        message: "Contraseña temporal generada y enviada por email",
      });
    } catch (err) {
      console.error("❌ Error en reset password:", err);
      return res
        .status(500)
        .json({ message: "Error interno al resetear la contraseña" });
    }
  }
);

module.exports = router;
