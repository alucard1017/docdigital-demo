// frontend/src/services/userPreferencesService.js
import api from "../api/client";

function normalizeLanguage(language) {
  if (typeof language !== "string") return "es";
  return language.toLowerCase().startsWith("en") ? "en" : "es";
}

function normalizeThemeMode(themeMode) {
  const value =
    typeof themeMode === "string" ? themeMode.trim().toLowerCase() : "";

  if (value === "light" || value === "dark") return value;
  return "system";
}

export async function getMyPreferences(config = {}) {
  const res = await api.get("/me/preferences", config);
  return res?.data?.data || null;
}

export async function updateMyPreferences(payload = {}, config = {}) {
  const body = {
    language: normalizeLanguage(payload.language),
    theme_mode: normalizeThemeMode(payload.theme_mode),
  };

  const res = await api.patch("/me/preferences", body, config);
  return res?.data?.data || null;
}

const userPreferencesService = {
  getMyPreferences,
  updateMyPreferences,
};

export default userPreferencesService;