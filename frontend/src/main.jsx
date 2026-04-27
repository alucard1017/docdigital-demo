// import "./sentry"; // desactivado temporalmente

import React from "react";
import ReactDOM from "react-dom/client";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

import App from "./App.jsx";
import "./i18n";

import "./styles/theme.css";
import "./styles/base.css";
import "./styles/appShell.css";
import "./styles/layout.css";
import "./styles/formsAndCards.css";
import "./styles/detailView.css";
import "./styles/detailActions.css";
import "./styles/documentsTable.css";
import "./styles/sidebar.css";
import "./styles/listStates.css";
import "./styles/states.css";
import "./styles/badges.css";
import "./styles/inbox.css";
import "./styles/actionsTable.css";
import "./styles/auth.css";
import "./styles/authLegacy.css";
import "./styles/companiesAdmin.css";
import "./styles/usersAdmin.css";
import "./styles/decorativeTabs.css";
import "./styles/listHeader.css";
import "./styles/settingsPanel.css";
import "./styles/floatingActions.css";
import "./styles/helpPanel.css";

import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./components/feedback/ToastProvider.jsx";

/* ================================
   MANEJO DE ERRORES DE CARGA
   ================================ */
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[VITE] Error cargando chunk dinámico. Recargando app...", event);
  event.preventDefault();
  window.location.reload();
});

/* ================================
   VALIDACIÓN DEL ROOT
   ================================ */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('No se encontró el elemento raíz con id="root".');
}

/* ================================
   WEB VITALS - MÉTRICAS DE RENDIMIENTO
   ================================ */
function sendMetric(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/metrics/web-vitals", body);
    return;
  }

  fetch("/api/metrics/web-vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

onCLS(sendMetric);
onINP(sendMetric);
onLCP(sendMetric);
onFCP(sendMetric);
onTTFB(sendMetric);

/* ================================
   ÁRBOL DE REACT
   ================================ */
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);

console.log("✓ Web Vitals inicializadas");