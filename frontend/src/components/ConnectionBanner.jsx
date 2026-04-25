// src/components/ConnectionBanner.jsx
import React from "react";
import "../styles/connection-banner.css";

export function ConnectionBanner({
  status,
  lastError,
  canRetry,
  onRetry,
}) {
  const normalized = String(status || "").toLowerCase();

  const isHealthy = normalized === "connected";
  const isReconnecting = normalized === "reconnecting";
  const isErrorLike =
    normalized === "error" || normalized === "disconnected";

  if (isHealthy && !isReconnecting && !isErrorLike) {
    return null;
  }

  const showMessage = isErrorLike || isReconnecting;

  const message = isReconnecting
    ? "Reconectando con el servidor en tiempo real…"
    : lastError ||
      "No pudimos mantener la conexión en tiempo real. La app sigue funcionando, pero algunas actualizaciones pueden tardar unos segundos.";

  const toneClass = isErrorLike ? "banner-danger" : "banner-warning";

  return (
    <div className={`connection-banner ${toneClass}`} role="status">
      <div className="connection-banner-left">
        <span className="connection-banner-dot" />
        <span className="connection-banner-text">
          {showMessage ? message : null}
        </span>
      </div>

      {canRetry && typeof onRetry === "function" && (
        <button
          type="button"
          className="connection-banner-retry"
          onClick={onRetry}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}