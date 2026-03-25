// frontend/src/PublicVerificationApp.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { VerificationView } from "./views/VerificationView";

/**
 * Obtener la URL base de la API desde variables de entorno
 */
const getApiBaseUrl = () => {
  // Prioridad:
  // 1. VITE_API_URL (recomendado)
  // 2. Fallback local
  const raw = import.meta.env.VITE_API_URL;

  if (raw && raw.trim()) {
    // Quita barras finales
    return raw.replace(/\/+$/, "");
  }

  // Fallback para desarrollo local
  return "http://localhost:4000/api";
};

const API_BASE_URL = getApiBaseUrl();

if (import.meta.env.DEV) {
  console.log("[PUBLIC_APP] API_BASE_URL:", API_BASE_URL);
}

function PublicVerificationApp() {
  return (
    <div className="public-verification-layout">
      <VerificationView API_URL={API_BASE_URL} />
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<PublicVerificationApp />);
} else {
  console.error("[PUBLIC_APP] No se encontró elemento #root");
}
