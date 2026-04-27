// src/services/userPreferencesService.js
import api from "../api/client";

const BASE_PATH = "/user-preferences";

export async function getUserPreferences() {
  const { data } = await api.get(BASE_PATH);
  return data;
}

export async function updateUserPreferences(payload) {
  const { data } = await api.put(BASE_PATH, payload);
  return data;
}

/* Compatibilidad legacy temporal */
export const getMyPreferences = getUserPreferences;
export const updateMyPreferences = updateUserPreferences;