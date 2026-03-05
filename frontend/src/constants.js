// src/constants.js

/**
 * API_BASE_URL SIMPLE que SIEMPRE funciona:
 * ✅ DEV: localhost:4000 (env o fallback)
 * ✅ PROD: verifirma-api.onrender.com (env o fallback) 
 * ❌ NO más runtimeConfig que falla en Render
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV 
    ? 'http://localhost:4000' 
    : 'https://verifirma-api.onrender.com'
  );

/**
 * Helper URLs API (usa siempre este en fetch/axios)
 */
export function apiUrl(path = "") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  // DEV: proxy automático (sin CORS)
  if (import.meta.env.DEV) {
    return `/api${cleanPath}`;
  }
  
  return `${API_BASE_URL}${cleanPath}`;
}

// Estados documentos
export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO",
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};

// URLs públicas (para enlaces email/share)
export const PUBLIC_URLS = {
  APP: import.meta.env.VITE_APP_URL || 'https://app.verifirma.cl',
  SIGN: import.meta.env.VITE_SIGN_BASE_URL || 'https://firmar.verifirma.cl',
  VERIFY: import.meta.env.VITE_VERIFY_BASE_URL || 'https://verificar.verifirma.cl'
};
