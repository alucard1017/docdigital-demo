// src/services/userPreferencesService.js
import api from "../api/client";

export async function getUserPreferences() {
  const { data } = await api.get("/user-preferences");
  return data;
}

export async function updateUserPreferences(payload) {
  const { data } = await api.put("/user-preferences", payload);
  return data;
}