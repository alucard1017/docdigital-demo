// backend/controllers/userPreferences.controller.js
const db = require("../db");

const ALLOWED_LANGUAGES = new Set(["es", "en"]);
const ALLOWED_THEME_MODES = new Set(["system", "light", "dark"]);
const ALLOWED_DENSITIES = new Set(["comfortable", "compact"]);

function normalizeLanguage(value) {
  if (typeof value !== "string") return "es";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_LANGUAGES.has(normalized) ? normalized : "es";
}

function normalizeThemeMode(value) {
  if (typeof value !== "string") return "system";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_THEME_MODES.has(normalized) ? normalized : "system";
}

function normalizeDensity(value) {
  if (typeof value !== "string") return "comfortable";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_DENSITIES.has(normalized) ? normalized : "comfortable";
}

async function getMyPreferences(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const userId = req.user.id;

    const result = await db.query(
      `
      SELECT
        user_id,
        language,
        theme_mode,
        COALESCE(density, 'comfortable') AS density,
        created_at,
        updated_at
      FROM user_preferences
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        user_id: userId,
        language: "es",
        theme_mode: "system",
        density: "comfortable",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error obteniendo preferencias del usuario:", error);
    return res.status(500).json({
      message: "No se pudieron obtener las preferencias del usuario.",
    });
  }
}

async function updateMyPreferences(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const userId = req.user.id;

    const language = normalizeLanguage(req.body?.language);
    const themeMode = normalizeThemeMode(req.body?.theme_mode);
    const density = normalizeDensity(req.body?.density);

    const result = await db.query(
      `
      INSERT INTO user_preferences (
        user_id,
        language,
        theme_mode,
        density,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        language = EXCLUDED.language,
        theme_mode = EXCLUDED.theme_mode,
        density = EXCLUDED.density,
        updated_at = NOW()
      RETURNING
        user_id,
        language,
        theme_mode,
        density,
        created_at,
        updated_at
      `,
      [userId, language, themeMode, density]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando preferencias del usuario:", error);
    return res.status(500).json({
      message: "No se pudieron guardar las preferencias del usuario.",
    });
  }
}

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};