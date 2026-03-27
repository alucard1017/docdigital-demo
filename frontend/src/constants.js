// src/constants.js

/**
 * Normaliza la URL base de la API a un formato consistente.
 *
 * Reglas:
 * - Usa VITE_API_URL si existe, si no, fallback a http://localhost:4000/api
 * - Elimina barras finales redundantes
 * - Colapsa /api/api al final en un solo /api
 * - Asegura que siempre termine en /api
 */
const getNormalizedApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

  if (typeof raw !== "string" || raw.trim() === "") {
    // Fallback ultra defensivo
    return "http://localhost:4000/api";
  }

  let normalized = raw.trim();

  // Eliminar todas las barras finales redundantes
  normalized = normalized.replace(/\/+$/, "");

  // Si quedó sin nada útil, fallback
  if (!normalized) {
    return "http://localhost:4000/api";
  }

  // Colapsar /api/api al final -> /api
  normalized = normalized.replace(/\/api\/api$/i, "/api");

  // Si no termina en /api, añadirlo
  if (!/\/api$/i.test(normalized)) {
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
 * Helper para construir URLs completas de API.
 *
 * Ej: apiUrl("/public/verificar/ABC") =>
 *     https://verifirma-api.onrender.com/api/public/verificar/ABC
 */
export function apiUrl(path = "") {
  const safeBase = API_BASE_URL || "http://localhost:4000/api";
  const normalizedPath =
    typeof path === "string" && path.length > 0
      ? path.startsWith("/")
        ? path
        : `/${path}`
      : "";

  return `${safeBase}${normalizedPath}`;
}

export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};