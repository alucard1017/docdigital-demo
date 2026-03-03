// src/constants.js

// Config de runtime inyectada por public/config.js (opcional)
const runtimeConfig = window.__APP_CONFIG__ || {};

// Normaliza una URL base (sin slash final)
function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Obtiene la base URL de la API con prioridad:
 * 1. runtimeConfig.API_BASE_URL (inyectado por public/config.js)
 * 2. import.meta.env.VITE_API_BASE_URL (Vite: .env.development / .env.production)
 * 3. "" si no hay nada (para detectar errores rápido)
 */
function resolveApiBaseUrl() {
  const fromRuntime = runtimeConfig.API_BASE_URL;
  const fromEnv = import.meta.env.VITE_API_BASE_URL;

  const raw = fromRuntime || fromEnv || "";

  // Log de ayuda en consola si no está configurado
  if (!raw) {
    // eslint-disable-next-line no-console
    console.error(
      "[config] API_BASE_URL no está definida. Revisa runtimeConfig.API_BASE_URL o VITE_API_BASE_URL en Vercel."
    );
  }

  return normalizeBaseUrl(raw);
}

// URL base de la API
export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Helper para construir URLs de la API de forma segura.
 * Ejemplo: apiUrl("/api/auth/login") => "https://verifirma-api.onrender.com/api/auth/login"
 */
export function apiUrl(path = "") {
  const base = API_BASE_URL;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

// Estados de documento normalizados
export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};
