// backend/controllers/users/profileController.js
const bcrypt = require("bcryptjs");
const db = require("../../db");
const { logAudit } = require("../../utils/auditLog");

/**
 * GET /api/users/profile
 * Obtener perfil del usuario actual
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT 
         id,
         run,
         email,
         name,
         role,
         company_id,
         email_verified,
         email_verified_at,
         created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo perfil:", err);
    return res.status(500).json({ message: "Error obteniendo perfil" });
  }
}

/**
 * PUT /api/users/profile
 * Actualizar datos del perfil
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (email) {
      // Verificar que el email no esté en uso
      const existingRes = await db.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email.toLowerCase(), userId]
      );

      if (existingRes.rowCount > 0) {
        return res.status(400).json({ message: "Email ya está en uso" });
      }

      updates.push(`email = $${paramIndex}`);
      params.push(email.toLowerCase());
      paramIndex++;
      
      // Si cambia email, marcar como no verificado
      updates.push(`email_verified = false`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    updates.push(`updated_at = NOW()`);
    params.push(userId);

    const result = await db.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, run, email, name, role, company_id, email_verified`,
      params
    );

    await logAudit({
      user: req.user,
      action: "USER_PROFILE_UPDATED",
      entityType: "user",
      entityId: userId,
      metadata: { name, email },
      req,
    });

    return res.json({
      message: "Perfil actualizado",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error actualizando perfil:", err);
    return res.status(500).json({ message: "Error actualizando perfil" });
  }
}

/**
 * POST /api/users/change-password
 * Cambiar contraseña
 */
async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Contraseña actual y nueva son obligatorias",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "La nueva contraseña debe tener al menos 6 caracteres",
      });
    }

    // Verificar contraseña actual
    const userRes = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = userRes.rows[0];
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: "Contraseña actual incorrecta" });
    }

    // Hashear nueva contraseña
    const newHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newHash, userId]
    );

    await logAudit({
      user: req.user,
      action: "USER_PASSWORD_CHANGED",
      entityType: "user",
      entityId: userId,
      metadata: {},
      req,
    });

    return res.json({ message: "Contraseña actualizada exitosamente" });
  } catch (err) {
    console.error("❌ Error cambiando contraseña:", err);
    return res.status(500).json({ message: "Error cambiando contraseña" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};
