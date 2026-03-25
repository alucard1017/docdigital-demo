// src/constants.js

/**
 * Obtener y normalizar la URL base de la API
 */
const getNormalizedApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

  // 1) Quitar barras finales
  let normalized = raw.replace(/\/+$/, "");

  // 2) Si viene con /api/api al final, reducir a /api
  normalized = normalized.replace(/\/api\/api$/, "/api");

  // 3) Asegurar que termina con /api (si no lo hace)
  if (!normalized.endsWith("/api")) {
    normalized = `${normalized}/api`;
  }

  return normalized;
};

/**
 * Base normalizada de la API.
 * Ejemplo en prod: https://verifirma-api.onrender.com/api
 * Ejemplo en local: http://localhost:4000/api
 */
export const API_BASE_URL = getNormalizedApiBase();

/**
 * Helper para construir URLs completas de API
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
