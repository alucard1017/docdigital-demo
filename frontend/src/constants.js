// src/constants.js

// Config de runtime inyectada por public/config.js
const runtimeConfig = window.__APP_CONFIG__ || {};

// Prioridad:
// 1. API_BASE_URL desde config.js (APP_API_BASE_URL en Render)
// 2. VITE_API_URL (para desarrollo local con Vite)
// 3. Cadena vacía si no hay nada (para detectar errores rápido)
export const API_BASE_URL =
  runtimeConfig.API_BASE_URL || import.meta.env.VITE_API_URL || "";

export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};
