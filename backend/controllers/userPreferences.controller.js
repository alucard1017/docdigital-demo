// backend/controllers/userPreferences.controller.js
const {
  getByUserId,
  upsert,
} = require("../services/userPreferences.service");

async function getMyPreferences(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const preferences = await getByUserId(userId);
    return res.json(preferences);
  } catch (error) {
    console.error("❌ Error obteniendo preferencias del usuario:", error);

    return res.status(500).json({
      message: "No se pudieron obtener las preferencias del usuario.",
    });
  }
}

async function updateMyPreferences(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const preferences = await upsert(userId, req.body || {});
    return res.json(preferences);
  } catch (error) {
    console.error("❌ Error actualizando preferencias del usuario:", error);

    if (error.statusCode === 400) {
      return res.status(400).json({
        message: error.message,
        code: error.code || "USER_PREFERENCES_INVALID",
        field: error.field || null,
      });
    }

    return res.status(500).json({
      message: "No se pudieron guardar las preferencias del usuario.",
    });
  }
}

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};