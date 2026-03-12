// src/components/Timeline.jsx
import React from "react";
import "./Timeline.css";

export function Timeline({ timeline }) {
  if (!timeline || !timeline.events) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#94a3b8",
        }}
      >
        Cargando progreso...
      </div>
    );
  }

  const { events, progress, currentStep, nextStep } = timeline;

  const getEventIcon = (event) => {
    const { action, source } = event;

    if (action === "CREADO") return "📄";
    if (action === "VISADO") return "✓";
    if (action === "FIRMADO") return "✓";
    if (action === "FIRMADO_PUBLICO") return "✓";
    if (action === "FIRMADO_REPRESENTANTE") return "✓";
    if (action === "RECHAZADO") return "✕";

    if (source === "audit_log") return "📝";

    return "◉";
  };

  const getEventStatus = (index, totalEvents) => {
    if (index < totalEvents - 1) return "completed";
    if (index === totalEvents - 1) return "active";
    return "pending";
  };

  const getEventTitle = (event) => {
    const { action, source } = event;

    if (action === "CREADO") return "📄 Documento Creado";
    if (action === "VISADO") return "✓ Documento Visado";
    if (action === "FIRMADO") return "✓ Documento Firmado";
    if (action === "FIRMADO_PUBLICO")
      return "✓ Documento firmado desde enlace público";
    if (action === "FIRMADO_REPRESENTANTE")
      return "✓ Firmado por Representante";
    if (action === "RECHAZADO") return "✕ Documento Rechazado";

    if (source === "audit_log") return `📝 Auditoría: ${action}`;

    return action;
  };

  const formatDetails = (event) => {
    if (event.details) return String(event.details);

    if (event.metadata && typeof event.metadata === "object") {
      const { document_id, title, status, ...rest } = event.metadata;
      const extras = Object.keys(rest).length ? JSON.stringify(rest) : "";
      return `Documento: ${title || document_id || "-"} | Estado: ${
        status || "-"
      } ${extras ? `| Extra: ${extras}` : ""}`;
    }

    return "";
  };

  return (
    <div className="timeline-container">
      {/* Header con progreso */}
      <div className="timeline-header">
        <h3
          style={{
            margin: "0 0 16px 0",
            color: "#1e293b",
            fontSize: "1.2rem",
            fontWeight: 800,
          }}
        >
          Progreso del Documento
        </h3>

        {/* Barra de progreso */}
        <div className="progress-bar-wrapper">
          <div className="progress-bar-background">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "8px",
              fontSize: "0.75rem",
              color: "#64748b",
            }}
          >
            <span>Inicio</span>
            <span style={{ fontWeight: 700, color: "#2563eb" }}>
              {progress}%
            </span>
            <span>Completado</span>
          </div>
        </div>

        {/* Estado actual */}
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            background: "#f0f9ff",
            borderRadius: "12px",
            border: "1px solid #bae6fd",
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              color: "#64748b",
              marginBottom: "4px",
            }}
          >
            Estado Actual
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#0369a1",
            }}
          >
            {currentStep}
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "#64748b",
              marginTop: "6px",
            }}
          >
            Próximo: {nextStep}
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div className="timeline-events">
        {events.map((event, index) => {
          const status = getEventStatus(index, events.length);
          const isLast = index === events.length - 1;

          return (
            <div
              key={`${event.source || "event"}-${event.id || index}`}
              className="timeline-event-wrapper"
            >
              {!isLast && (
                <div
                  className={`timeline-line timeline-line-${status}`}
                ></div>
              )}

              <div className={`timeline-dot timeline-dot-${status}`}>
                <span className="timeline-icon">{getEventIcon(event)}</span>
              </div>

              <div className={`timeline-content timeline-content-${status}`}>
                <h4
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  {getEventTitle(event)}
                </h4>

                {formatDetails(event) && (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "0.85rem",
                      color: "#475569",
                    }}
                  >
                    {formatDetails(event)}
                  </p>
                )}

                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                  }}
                >
                  {new Date(event.timestamp).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {event.actor && (
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "0.75rem",
                      color:
                        event.source === "audit_log" ? "#0f766e" : "#7c3aed",
                      fontWeight: 600,
                    }}
                  >
                    Por: {event.actor}
                  </p>
                )}

                {event.source === "audit_log" && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    {event.ip && <div>IP: {event.ip}</div>}
                    {event.userAgent && (
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={event.userAgent}
                      >
                        Agente: {event.userAgent}
                      </div>
                    )}
                    {event.requestId && <div>Req ID: {event.requestId}</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
