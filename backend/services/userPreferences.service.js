// backend/services/userPreferences.service.js
const db = require("../db");

const ALLOWED_LANGUAGES = new Set(["es", "en"]);
const ALLOWED_THEME_MODES = new Set(["light", "dark", "system"]);
const ALLOWED_DENSITIES = new Set(["comfortable", "compact"]);

const DEFAULT_PREFERENCES = Object.freeze({
  language: "es",
  theme_mode: "system",
  density: "comfortable",
});

function createValidationError(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "USER_PREFERENCES_INVALID";
  error.field = field;
  return error;
}

function normalizeLanguage(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw createValidationError("Invalid language", "language");
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_LANGUAGES.has(normalized)) {
    throw createValidationError("Invalid language", "language");
  }

  return normalized;
}

function normalizeThemeMode(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw createValidationError("Invalid theme_mode", "theme_mode");
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_THEME_MODES.has(normalized)) {
    throw createValidationError("Invalid theme_mode", "theme_mode");
  }

  return normalized;
}

function normalizeDensity(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw createValidationError("Invalid density", "density");
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_DENSITIES.has(normalized)) {
    throw createValidationError("Invalid density", "density");
  }

  return normalized;
}

function mapRow(row, userId = null) {
  return {
    user_id: row?.user_id ?? userId ?? null,
    language: row?.language || DEFAULT_PREFERENCES.language,
    theme_mode: row?.theme_mode || DEFAULT_PREFERENCES.theme_mode,
    density: row?.density || DEFAULT_PREFERENCES.density,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

async function getByUserId(userId) {
  const { rows } = await db.query(
    `
      SELECT
        id,
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

  if (!rows[0]) {
    return mapRow(null, userId);
  }

  return mapRow(rows[0], userId);
}

async function upsert(userId, payload = {}) {
  const language = normalizeLanguage(payload.language);
  const themeMode = normalizeThemeMode(payload.theme_mode);
  const density = normalizeDensity(payload.density);

  const { rows } = await db.query(
    `
      INSERT INTO user_preferences (
        user_id,
        language,
        theme_mode,
        density,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        COALESCE($2, $5),
        COALESCE($3, $6),
        COALESCE($4, $7),
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        language = COALESCE($2, user_preferences.language),
        theme_mode = COALESCE($3, user_preferences.theme_mode),
        density = COALESCE($4, user_preferences.density),
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        language,
        theme_mode,
        density,
        created_at,
        updated_at
    `,
    [
      userId,
      language,
      themeMode,
      density,
      DEFAULT_PREFERENCES.language,
      DEFAULT_PREFERENCES.theme_mode,
      DEFAULT_PREFERENCES.density,
    ]
  );

  return mapRow(rows[0], userId);
}

module.exports = {
  ALLOWED_LANGUAGES,
  ALLOWED_THEME_MODES,
  ALLOWED_DENSITIES,
  DEFAULT_PREFERENCES,
  getByUserId,
  upsert,
};