// src/components/Timeline.jsx
import React, { useMemo } from "react";
import "./Timeline.css";

function formatTimestamp(ts) {
  if (!ts) return "";
  const date = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventIcon(event) {
  const action = String(event.action || "").toUpperCase();
  const source = event.source;

  if (action === "CREADO") return "📄";
  if (action === "VISADO") return "✓";
  if (action === "FIRMADO") return "✓";
  if (action === "FIRMADO_PUBLICO") return "✓";
  if (action === "FIRMADO_REPRESENTANTE") return "✓";
  if (action === "RECHAZADO") return "✕";

  if (source === "audit_log") return "📝";

  return "◉";
}

function getEventTitle(event) {
  const action = String(event.action || "").toUpperCase();
  const source = event.source;

  if (action === "CREADO") return "📄 Documento creado";
  if (action === "VISADO") return "✓ Documento visado";
  if (action === "FIRMADO") return "✓ Documento firmado";
  if (action === "FIRMADO_PUBLICO")
    return "✓ Documento firmado desde enlace público";
  if (action === "FIRMADO_REPRESENTANTE")
    return "✓ Firmado por representante";
  if (action === "RECHAZADO") return "✕ Documento rechazado";

  if (source === "audit_log") return `📝 Registro de auditoría (${action})`;

  return action || "Evento";
}

function getEventStatus(index, total) {
  if (index < total - 1) return "completed";
  if (index === total - 1) return "active";
  return "pending";
}

function formatDetails(event) {
  if (event.details) return String(event.details);

  if (event.metadata && typeof event.metadata === "object") {
    const { document_id, title, status, ...rest } = event.metadata;
    const extras =
      Object.keys(rest).length > 0 ? JSON.stringify(rest) : "";
    return `Documento: ${title || document_id || "-"} · Estado: ${
      status || "-"
    }${extras ? ` · Extra: ${extras}` : ""}`;
  }

  return "";
}

export function Timeline({ timeline }) {
  const hasEvents = !!timeline && Array.isArray(timeline.events);

  const { events, progress, currentStep, nextStep } = useMemo(
    () => ({
      events: hasEvents ? timeline.events : [],
      progress: Number.isFinite(timeline?.progress)
        ? Math.max(0, Math.min(100, timeline.progress))
        : 0,
      currentStep: timeline?.currentStep || "En curso",
      nextStep: timeline?.nextStep || "Por definir",
    }),
    [timeline, hasEvents]
  );

  if (!hasEvents) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#94a3b8",
        }}
      >
        Cargando historial del documento…
      </div>
    );
  }

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
          Progreso del documento
        </h3>

        <div className="progress-bar-wrapper">
          <div className="progress-bar-background">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
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
            Estado actual
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
            Próximo paso:{" "}
            <span style={{ fontWeight: 600 }}>{nextStep}</span>
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div className="timeline-events">
        {events.map((event, index) => {
          const status = getEventStatus(index, events.length);
          const isLast = index === events.length - 1;
          const detailsText = formatDetails(event);
          const timestampText = formatTimestamp(event.timestamp);
          const isAudit = event.source === "audit_log";

          return (
            <div
              key={`${event.source || "event"}-${event.id || index}`}
              className="timeline-event-wrapper"
            >
              {!isLast && (
                <div
                  className={`timeline-line timeline-line-${status}`}
                />
              )}

              <div className={`timeline-dot timeline-dot-${status}`}>
                <span className="timeline-icon">
                  {getEventIcon(event)}
                </span>
              </div>

              <div
                className={`timeline-content timeline-content-${status}`}
              >
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

                {detailsText && (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "0.85rem",
                      color: "#475569",
                    }}
                  >
                    {detailsText}
                  </p>
                )}

                {timestampText && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: "0.75rem",
                      color: "#94a3b8",
                    }}
                  >
                    {timestampText}
                  </p>
                )}

                {event.actor && (
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "0.75rem",
                      color: isAudit ? "#0f766e" : "#7c3aed",
                      fontWeight: 600,
                    }}
                  >
                    {isAudit ? "Sistema / Auditoría" : "Por:"}{" "}
                    {event.actor}
                  </p>
                )}

                {isAudit && (
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
                    {event.requestId && (
                      <div>Req ID: {event.requestId}</div>
                    )}
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