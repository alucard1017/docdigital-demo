// src/constants.js

// Base URL de la API: prioriza VITE_API_URL y normaliza
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(
    /\/+$/,
    ""
  );

// Helper para construir URLs completas de API cuando necesites string directo
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
