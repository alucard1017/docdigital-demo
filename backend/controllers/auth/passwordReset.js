// backend/controllers/auth/passwordReset.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../../db");
const { sendNotification } = require("../../services/emailService");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://app.verifirma.cl";

/**
 * POST /api/auth/forgot-password
 * Solicitar reset de contraseña
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email es obligatorio" });
    }

    const userRes = await db.query(
      `SELECT id, name, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    // Por seguridad, siempre responder OK aunque no exista
    if (userRes.rowCount === 0) {
      return res.json({ 
        message: "Si el email existe, recibirás un enlace de recuperación" 
      });
    }

    const user = userRes.rows[0];

    // Generar token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

    const subject = "Recuperación de contraseña - VeriFirma";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a8a;">Recuperación de Contraseña</h2>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en VeriFirma.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0;">
          Restablecer Contraseña
        </a>
        <p style="font-size:0.9rem;color:#6b7280;margin-top:16px;">
          Este enlace expira en 1 hora.
        </p>
        <p style="font-size:0.85rem;color:#9ca3af;margin-top:8px;">
          Si no solicitaste este cambio, ignora este mensaje.
        </p>
      </div>
    `;

    await sendNotification(user.email, subject, html);

    return res.json({ 
      message: "Si el email existe, recibirás un enlace de recuperación" 
    });
  } catch (err) {
    console.error("❌ Error en forgot password:", err);
    return res.status(500).json({ message: "Error procesando solicitud" });
  }
}

/**
 * POST /api/auth/reset-password
 * Restablecer contraseña con token
 */
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        message: "Token y nueva contraseña son obligatorios" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "La contraseña debe tener al menos 6 caracteres" 
      });
    }

    const tokenRes = await db.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used_at IS NULL`,
      [token]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(404).json({ message: "Token inválido o ya usado" });
    }

    const resetToken = tokenRes.rows[0];

    if (new Date() > new Date(resetToken.expires_at)) {
      return res.status(400).json({ message: "Token expirado" });
    }

    // Hash nueva contraseña
    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [hash, resetToken.user_id]
    );

    // Marcar token como usado
    await db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [resetToken.id]
    );

    return res.json({ message: "Contraseña restablecida exitosamente" });
  } catch (err) {
    console.error("❌ Error reseteando contraseña:", err);
    return res.status(500).json({ message: "Error reseteando contraseña" });
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
};
