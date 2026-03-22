// backend/controllers/auth/emailVerification.js
const crypto = require("crypto");
const db = require("../../db");
const { sendNotification } = require("../../services/emailService");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://app.verifirma.cl";

/**
 * POST /api/auth/send-verification
 * Enviar email de verificación
 */
async function sendVerificationEmail(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email es obligatorio" });
    }

    // Verificar que el usuario existe
    const userRes = await db.query(
      `SELECT id, name, email_verified FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = userRes.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ message: "Email ya verificado" });
    }

    // Generar token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await db.query(
      `INSERT INTO email_verifications (email, token, expires_at)
       VALUES ($1, $2, $3)`,
      [email.toLowerCase(), token, expiresAt]
    );

    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

    const subject = "Verifica tu email en VeriFirma";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a8a;">Verifica tu email</h2>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Por favor verifica tu email haciendo clic en el siguiente enlace:</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px;">
          Verificar Email
        </a>
        <p style="margin-top:16px;font-size:0.9rem;color:#6b7280;">
          Este enlace expira en 24 horas.
        </p>
        <p style="font-size:0.85rem;color:#9ca3af;">
          Si no solicitaste esta verificación, ignora este mensaje.
        </p>
      </div>
    `;

    await sendNotification(email, subject, html);

    return res.json({ message: "Email de verificación enviado" });
  } catch (err) {
    console.error("❌ Error enviando verificación:", err);
    return res.status(500).json({ message: "Error enviando verificación" });
  }
}

/**
 * POST /api/auth/verify-email
 * Verificar email con token
 */
async function verifyEmail(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token es obligatorio" });
    }

    const verifyRes = await db.query(
      `SELECT * FROM email_verifications
       WHERE token = $1 AND verified_at IS NULL`,
      [token]
    );

    if (verifyRes.rowCount === 0) {
      return res.status(404).json({ message: "Token inválido o ya usado" });
    }

    const verification = verifyRes.rows[0];

    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ message: "Token expirado" });
    }

    // Marcar como verificado
    await db.query(
      `UPDATE email_verifications
       SET verified_at = NOW()
       WHERE id = $1`,
      [verification.id]
    );

    await db.query(
      `UPDATE users
       SET email_verified = true,
           email_verified_at = NOW()
       WHERE email = $1`,
      [verification.email]
    );

    return res.json({ message: "Email verificado exitosamente" });
  } catch (err) {
    console.error("❌ Error verificando email:", err);
    return res.status(500).json({ message: "Error verificando email" });
  }
}

module.exports = {
  sendVerificationEmail,
  verifyEmail,
};
