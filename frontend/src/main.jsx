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
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { ToastProvider } from "./components/feedback/ToastProvider.jsx";
import { API_BASE_URL } from "./constants";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('No se encontró el elemento raíz con id="root".');
}

let hasHandledPreloadError = false;

window.addEventListener("vite:preloadError", (event) => {
  if (hasHandledPreloadError) return;
  hasHandledPreloadError = true;

  console.warn("[VITE] Error cargando chunk dinámico. Recargando app...", event);
  event.preventDefault();
  window.location.reload();
});

function joinUrl(base, path) {
  const normalizedBase = String(base || "").replace(/\/+$/, "");
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

const WEB_VITALS_ENDPOINT = joinUrl(API_BASE_URL, "/metrics/web-vitals");

function sendMetric(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType || "unknown",
    path:
      window.location.pathname +
      window.location.search +
      window.location.hash,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(WEB_VITALS_ENDPOINT, blob);
    return;
  }

  fetch(WEB_VITALS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

[onCLS, onINP, onLCP, onFCP, onTTFB].forEach((handler) => handler(sendMetric));

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);

if (import.meta.env?.DEV) {
  console.log("✓ Web Vitals inicializadas");
  console.log("✓ Web Vitals endpoint:", WEB_VITALS_ENDPOINT);
}