// src/components/EventList.jsx
import React from "react";

export function EventList({ events }) {
  const safeEvents = Array.isArray(events) ? events : [];

  // Mapa de iconos por acción
  const actionIcons = {
    CREADO: '📄',
    FIRMADO: '✍️',
    VISADO: '👁️',
    RECHAZADO: '❌',
  };

  // Mapa de colores por acción
  const actionColors = {
    CREADO: '#3b82f6',    // azul
    FIRMADO: '#10b981',   // verde
    VISADO: '#f59e0b',    // ámbar
    RECHAZADO: '#ef4444', // rojo
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (safeEvents.length === 0) {
    return (
      <p
        style={{
          fontSize: "0.85rem",
          color: "#9ca3af",
          padding: "12px",
          background: "#f3f4f6",
          borderRadius: "6px",
        }}
      >
        📭 No hay eventos registrados para este documento.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {safeEvents.map((e, idx) => (
        <div
          key={e.id || `${e.action}-${e.timestamp}`}
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
            borderRadius: 8,
            background: "#f9fafb",
            border: `1px solid ${actionColors[e.action] || '#e5e7eb'}`,
            borderLeft: `4px solid ${actionColors[e.action] || '#e5e7eb'}`,
          }}
        >
          {/* Icono */}
          <div
            style={{
              fontSize: "1.5rem",
              minWidth: "32px",
              textAlign: "center",
              lineHeight: "1",
            }}
          >
            {actionIcons[e.action] || '📋'}
          </div>

          {/* Contenido */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: actionColors[e.action] || '#1e293b',
                  fontSize: "0.9rem",
                }}
              >
                {e.action}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                {formatDate(e.timestamp)}
              </span>
            </div>

            <p
              style={{
                margin: "4px 0",
                fontSize: "0.85rem",
                color: "#4b5563",
                lineHeight: "1.4",
              }}
            >
              {e.details}
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: "0.8rem",
                color: "#9ca3af",
                marginTop: 6,
              }}
            >
              <span>👤 {e.actor}</span>
              {e.fromStatus && e.toStatus && (
                <span>
                  {e.fromStatus} → <strong>{e.toStatus}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
