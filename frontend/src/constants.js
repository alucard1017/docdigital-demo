// src/constants.js

// Config de runtime inyectada por public/config.js (opcional)
const runtimeConfig = window.__APP_CONFIG__ || {};

// Normaliza una URL base (sin slash final)
function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * API_BASE_URL
 *
 * Prioridad:
 * 1. runtimeConfig.API_BASE_URL (inyectado por public/config.js)
 * 2. import.meta.env.VITE_API_BASE_URL (Vite: .env.development / .env.production)
 * 3. "" si no hay nada (para detectar errores rápido)
 */
const rawApiBaseUrl =
  runtimeConfig.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "";

export const API_BASE_URL = normalizeBaseUrl(rawApiBaseUrl);

// Estados de documento normalizados
export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};
