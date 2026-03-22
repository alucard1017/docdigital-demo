// backend/controllers/notifications/notificationsController.js
const db = require("../../db");
const { emitToCompany } = require("../../services/socketService");

/**
 * GET /api/notifications
 * Obtener notificaciones del usuario
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 50, unreadOnly } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];

    if (unreadOnly === "true") {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2`;
    params.push(Number(limit));

    const result = await db.query(query, params);

    const unreadCount = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId]
    );

    return res.json({
      notifications: result.rows,
      unread_count: Number(unreadCount.rows[0].count),
    });
  } catch (err) {
    console.error("❌ Error obteniendo notificaciones:", err);
    return res.status(500).json({ message: "Error obteniendo notificaciones" });
  }
}

/**
 * POST /api/notifications/:id/read
 * Marcar notificación como leída
 */
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications
       SET read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return res.json({ message: "Notificación marcada como leída" });
  } catch (err) {
    console.error("❌ Error marcando notificación:", err);
    return res.status(500).json({ message: "Error marcando notificación" });
  }
}

/**
 * POST /api/notifications/read-all
 * Marcar todas como leídas
 */
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications
       SET read = true, read_at = NOW()
       WHERE user_id = $1 AND read = false`,
      [userId]
    );

    return res.json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (err) {
    console.error("❌ Error marcando todas:", err);
    return res.status(500).json({ message: "Error marcando notificaciones" });
  }
}

/**
 * Helper: Crear notificación
 */
async function createNotification({
  userId,
  companyId = null,
  title,
  message,
  type = "info",
  link = null,
}) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, company_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, companyId, title, message, type, link]
    );

    const notification = result.rows[0];

    // Emitir por WebSocket
    if (companyId) {
      emitToCompany(companyId, "notification:new", notification);
    }

    return notification;
  } catch (err) {
    console.error("❌ Error creando notificación:", err);
    throw err;
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
};
