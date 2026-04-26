const db = require("../db");

const ALLOWED_LANGUAGES = ["es", "en"];
const ALLOWED_THEME_MODES = ["light", "dark", "system"];

async function getByUserId(userId) {
  const { rows } = await db.query(
    `
      SELECT
        id,
        user_id,
        language,
        theme_mode,
        created_at,
        updated_at
      FROM user_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || {
    user_id: userId,
    language: "es",
    theme_mode: "system",
  };
}

async function upsert(userId, payload = {}) {
  const language = payload.language ?? null;
  const themeMode = payload.theme_mode ?? null;

  if (language && !ALLOWED_LANGUAGES.includes(language)) {
    const error = new Error("Invalid language");
    error.statusCode = 400;
    error.code = "USER_PREFERENCES_INVALID";
    throw error;
  }

  if (themeMode && !ALLOWED_THEME_MODES.includes(themeMode)) {
    const error = new Error("Invalid theme_mode");
    error.statusCode = 400;
    error.code = "USER_PREFERENCES_INVALID";
    throw error;
  }

  const { rows } = await db.query(
    `
      INSERT INTO user_preferences (
        user_id,
        language,
        theme_mode,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        COALESCE($2, 'es'),
        COALESCE($3, 'system'),
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        language = COALESCE($2, user_preferences.language),
        theme_mode = COALESCE($3, user_preferences.theme_mode),
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        language,
        theme_mode,
        created_at,
        updated_at
    `,
    [userId, language, themeMode]
  );

  return rows[0];
}

module.exports = {
  getByUserId,
  upsert,
};