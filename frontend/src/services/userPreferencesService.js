// src/services/userPreferencesService.js
import api from "../api/client";

const BASE_PATH = "/user-preferences";

let pendingGetPreferencesPromise = null;

/**
 * GET /api/user-preferences
 * Devuelve las preferencias del usuario autenticado.
 */
export async function getUserPreferences(config = {}) {
  if (!pendingGetPreferencesPromise) {
    pendingGetPreferencesPromise = api
      .get(BASE_PATH, config)
      .then(({ data }) => data ?? {})
      .finally(() => {
        pendingGetPreferencesPromise = null;
      });
  }

  return pendingGetPreferencesPromise;
}

/**
 * PUT /api/user-preferences
 * Crea o actualiza las preferencias del usuario autenticado.
 */
export async function updateUserPreferences(payload, config = {}) {
  const { data } = await api.put(BASE_PATH, payload, config);
  return data ?? {};
}

// Alias semánticos por si los usas en otros sitios
export const getMyPreferences = getUserPreferences;
export const updateMyPreferences = updateUserPreferences;

const userPreferencesService = {
  getUserPreferences,
  updateUserPreferences,
  getMyPreferences,
  updateMyPreferences,
};

export default userPreferencesService;