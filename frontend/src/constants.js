// src/constants.js

// Base URL de la API: prioriza VITE_API_URL (sin / al final)
const rawApiBase =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// 1) quitar / al final
let normalizedApiBase = rawApiBase.replace(/\/+$/, "");

// 2) si viene con /api/api al final, reducir a /api
normalizedApiBase = normalizedApiBase.replace(/\/api\/api$/, "/api");

// 3) asegurar que termina con /api
if (!normalizedApiBase.endsWith("/api")) {
  normalizedApiBase = `${normalizedApiBase}/api`;
}

/**
 * Base normalizada de la API.
 * Ejemplo en prod: https://verifirma-api.onrender.com/api
 */
export const API_BASE_URL = normalizedApiBase;

/**
 * Helper para construir URLs completas de API cuando necesites string directo.
 * Ej: apiUrl("/public/verificar/ABC") =>
 *     https://verifirma-api.onrender.com/api/public/verificar/ABC
 */
export function apiUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};
