// src/components/EventList.jsx
import React from "react";
import "./EventList.css";

function getSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSource(event) {
  return event?.source || event?.metadata?.source || "document_events";
}

function getTimestamp(event) {
  return event?.timestamp || event?.createdAt || null;
}

function getDetails(event) {
  return event?.details || event?.metadata?.details || "";
}

function getRequestId(event) {
  return event?.requestId || event?.metadata?.request_id || null;
}

function normalizeAction(action, eventType) {
  const raw = String(action || eventType || "")
    .trim()
    .toUpperCase();

  if (!raw) return "EVENTO";

  if (raw.includes("CREATED") || raw.includes("CREADO")) return "CREADO";
  if (
    raw.includes("SIGNED") ||
    raw.includes("FIRMADO") ||
    raw.includes("FIRMAR")
  ) {
    return "FIRMADO";
  }
  if (
    raw.includes("APPROVED") ||
    raw.includes("VISADO") ||
    raw.includes("VISAR") ||
    raw.includes("REVIEW")
  ) {
    return "VISADO";
  }
  if (
    raw.includes("REJECTED") ||
    raw.includes("RECHAZADO") ||
    raw.includes("RECHAZAR")
  ) {
    return "RECHAZADO";
  }

  return raw;
}

function formatDate(timestamp) {
  if (!timestamp) return "-";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDetails(event) {
  const directDetails = getDetails(event);
  if (directDetails) return String(directDetails);

  if (event?.metadata && typeof event.metadata === "object") {
    const {
      document_id,
      title,
      status,
      details,
      request_id,
      source,
      user_id,
      company_id,
      hash_document,
      ...rest
    } = event.metadata;

    const parts = [];

    if (title || document_id) {
      parts.push(`Documento: ${title || document_id}`);
    }

    if (status) {
      parts.push(`Estado: ${status}`);
    }

    const usefulRest = Object.entries(rest).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    );

    if (usefulRest.length > 0) {
      parts.push(
        `Extra: ${JSON.stringify(Object.fromEntries(usefulRest))}`
      );
    }

    return parts.join(" | ");
  }

  return "";
}

export function EventList({ events }) {
  const safeEvents = getSafeArray(events);

  const actionIcons = {
    CREADO: "📄",
    FIRMADO: "✍️",
    VISADO: "👁️",
    RECHAZADO: "❌",
    EVENTO: "📋",
  };

  const actionClassNames = {
    CREADO: "event-item--created",
    FIRMADO: "event-item--signed",
    VISADO: "event-item--approved",
    RECHAZADO: "event-item--rejected",
    EVENTO: "event-item--neutral",
  };

  const sourceConfig = {
    document_events: {
      label: "Flujo",
      className: "event-source-pill event-source-pill--flow",
    },
    audit_log: {
      label: "Auditoría",
      className: "event-source-pill event-source-pill--audit",
    },
    public: {
      label: "Público",
      className: "event-source-pill event-source-pill--public",
    },
    owner: {
      label: "Propietario",
      className: "event-source-pill event-source-pill--owner",
    },
    internal_flow: {
      label: "Interno",
      className: "event-source-pill event-source-pill--internal",
    },
  };

  if (safeEvents.length === 0) {
    return (
      <p className="event-list-empty">
        📭 No hay eventos registrados para este documento.
      </p>
    );
  }

  return (
    <ul className="event-list">
      {safeEvents.map((event) => {
        const normalizedAction = normalizeAction(
          event?.action,
          event?.eventType
        );

        const icon = actionIcons[normalizedAction] || actionIcons.EVENTO;
        const source = getSource(event);
        const sourceCfg =
          sourceConfig[source] || sourceConfig.document_events;
        const timestamp = getTimestamp(event);
        const details = formatDetails(event);
        const requestId = getRequestId(event);
        const itemClassName =
          actionClassNames[normalizedAction] || actionClassNames.EVENTO;

        return (
          <li
            key={
              event?.id ||
              `${source}-${normalizedAction}-${timestamp || "no-date"}`
            }
            className={`event-item ${itemClassName}`}
          >
            <div className="event-item-icon" aria-hidden="true">
              {icon}
            </div>

            <div className="event-item-body">
              <header className="event-item-header">
                <div className="event-item-title-row">
                  <span className="event-item-action">
                    {normalizedAction}
                  </span>

                  <span className={sourceCfg.className}>
                    {sourceCfg.label}
                  </span>
                </div>

                <time className="event-item-timestamp">
                  {formatDate(timestamp)}
                </time>
              </header>

              {details && (
                <p className="event-item-details">{details}</p>
              )}

              <ul className="event-item-meta">
                {event?.actor && <li>👤 {event.actor}</li>}

                {event?.fromStatus && event?.toStatus && (
                  <li>
                    {event.fromStatus} → <strong>{event.toStatus}</strong>
                  </li>
                )}

                {event?.ip && <li>IP: {event.ip}</li>}

                {requestId && <li>Req ID: {requestId}</li>}
              </ul>

              {event?.userAgent && (
                <div
                  className="event-item-user-agent"
                  title={event.userAgent}
                >
                  Agente: {event.userAgent}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}