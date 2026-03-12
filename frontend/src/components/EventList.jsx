// src/components/EventList.jsx
import React from "react";

export function EventList({ events }) {
  const safeEvents = Array.isArray(events) ? events : [];

  const actionIcons = {
    CREADO: "📄",
    FIRMADO: "✍️",
    VISADO: "👁️",
    RECHAZADO: "❌",
  };

  const actionColors = {
    CREADO: "#3b82f6", // azul
    FIRMADO: "#10b981", // verde
    VISADO: "#f59e0b", // ámbar
    RECHAZADO: "#ef4444", // rojo
  };

  const sourceConfig = {
    document_events: { label: "Flujo", bg: "#dbeafe", color: "#1d4ed8" },
    audit_log: { label: "Auditoría", bg: "#fef3c7", color: "#92400e" },
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDetails = (e) => {
    if (e.details) return String(e.details);

    if (e.metadata && typeof e.metadata === "object") {
      const { document_id, title, status, ...rest } = e.metadata;
      const partes = [];
      if (title || document_id) {
        partes.push(`Documento: ${title || document_id}`);
      }
      if (status) {
        partes.push(`Estado: ${status}`);
      }
      const extras = Object.keys(rest).length ? JSON.stringify(rest) : "";
      if (extras) partes.push(`Extra: ${extras}`);
      return partes.join(" | ");
    }

    return "";
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
      {safeEvents.map((e) => {
        const color = actionColors[e.action] || "#e5e7eb";
        const icon = actionIcons[e.action] || "📋";
        const sourceCfg =
          sourceConfig[e.source] || sourceConfig.document_events;

        return (
          <div
            key={e.id || `${e.source}-${e.action}-${e.timestamp}`}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              borderRadius: 8,
              background: "#f9fafb",
              border: `1px solid ${color}`,
              borderLeft: `4px solid ${color}`,
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
              {icon}
            </div>

            {/* Contenido */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: color === "#e5e7eb" ? "#1e293b" : color,
                      fontSize: "0.9rem",
                    }}
                  >
                    {e.action}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: sourceCfg.bg,
                      color: sourceCfg.color,
                      textTransform: "uppercase",
                    }}
                  >
                    {sourceCfg.label}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                  }}
                >
                  {formatDate(e.timestamp)}
                </span>
              </div>

              {formatDetails(e) && (
                <p
                  style={{
                    margin: "4px 0",
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    lineHeight: "1.4",
                  }}
                >
                  {formatDetails(e)}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                  marginTop: 6,
                }}
              >
                {e.actor && <span>👤 {e.actor}</span>}
                {e.fromStatus && e.toStatus && (
                  <span>
                    {e.fromStatus} → <strong>{e.toStatus}</strong>
                  </span>
                )}
                {e.ip && <span>IP: {e.ip}</span>}
                {e.requestId && <span>Req ID: {e.requestId}</span>}
              </div>

              {e.userAgent && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: "0.75rem",
                    color: "#a1a1aa",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={e.userAgent}
                >
                  Agente: {e.userAgent}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
