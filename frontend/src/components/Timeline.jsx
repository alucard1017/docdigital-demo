import React, { useMemo } from "react";
import "./Timeline.css";

function normalizeText(value = "") {
  return String(value ?? "").trim();
}

function normalizeUpper(value = "") {
  return normalizeText(value).toUpperCase();
}

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value) {
  const date = toValidDate(value);
  if (!date) return "";

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clampProgress(value) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAuditEvent(event) {
  return normalizeText(event?.source).toLowerCase() === "audit_log";
}

function getEventAction(event) {
  return normalizeUpper(event?.action);
}

function getEventIcon(event) {
  const action = getEventAction(event);

  switch (action) {
    case "CREADO":
      return "📄";
    case "VISADO":
    case "FIRMADO":
    case "FIRMADO_PUBLICO":
    case "FIRMADO_REPRESENTANTE":
      return "✓";
    case "RECHAZADO":
      return "✕";
    default:
      return isAuditEvent(event) ? "📝" : "◉";
  }
}

function getEventTitle(event) {
  const action = getEventAction(event);
  const audit = isAuditEvent(event);

  switch (action) {
    case "CREADO":
      return "Documento creado";
    case "VISADO":
      return "Documento visado";
    case "FIRMADO":
      return "Documento firmado";
    case "FIRMADO_PUBLICO":
      return "Documento firmado desde enlace público";
    case "FIRMADO_REPRESENTANTE":
      return "Firmado por representante";
    case "RECHAZADO":
      return "Documento rechazado";
    default:
      return audit && action ? `Registro de auditoría (${action})` : action || "Evento";
  }
}

function getEventStatus(index, total) {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
    return "pending";
  }

  if (index < total - 1) return "completed";
  if (index === total - 1) return "active";
  return "pending";
}

function safeJsonPreview(value, maxLength = 220) {
  try {
    const text = JSON.stringify(value);
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    return "";
  }
}

function buildMetadataSummary(metadata) {
  if (!isObject(metadata)) return "";

  const {
    document_id,
    documentId,
    title,
    documentTitle,
    status,
    documentStatus,
    ...rest
  } = metadata;

  const resolvedDocument = normalizeText(
    title || documentTitle || document_id || documentId || "-"
  );
  const resolvedStatus = normalizeText(status || documentStatus || "-");
  const extras = Object.keys(rest).length > 0 ? safeJsonPreview(rest) : "";

  return `Documento: ${resolvedDocument} · Estado: ${resolvedStatus}${
    extras ? ` · Extra: ${extras}` : ""
  }`;
}

function formatDetails(event) {
  const directDetails = normalizeText(event?.details);
  if (directDetails) return directDetails;

  return buildMetadataSummary(event?.metadata);
}

function getActorLabel(event) {
  const actor = normalizeText(event?.actor);
  if (actor) return actor;
  if (isAuditEvent(event)) return "Sistema / Auditoría";
  return "";
}

function getAuditMeta(event) {
  return {
    ip: normalizeText(event?.ip),
    userAgent: normalizeText(event?.userAgent),
    requestId: normalizeText(event?.requestId),
  };
}

function getStableEventKey(event, index) {
  const parts = [
    normalizeText(event?.source) || "event",
    normalizeText(event?.id) || "no-id",
    normalizeText(event?.timestamp) || "no-ts",
    normalizeText(event?.action) || "no-action",
    String(index),
  ];

  return parts.join("-");
}

function normalizeTimeline(rawTimeline) {
  const events = Array.isArray(rawTimeline?.events) ? rawTimeline.events : [];

  return {
    events,
    hasEvents: events.length > 0,
    progress: clampProgress(rawTimeline?.progress),
    currentStep: normalizeText(rawTimeline?.currentStep) || "En curso",
    nextStep: normalizeText(rawTimeline?.nextStep) || "Por definir",
  };
}

export function Timeline({ timeline }) {
  const hasTimelineObject = isObject(timeline);

  const { events, hasEvents, progress, currentStep, nextStep } = useMemo(
    () => normalizeTimeline(timeline),
    [timeline]
  );

  if (!hasTimelineObject) {
    return (
      <div className="timeline-empty-state">
        Cargando historial del documento…
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3 className="timeline-heading">Progreso del documento</h3>

        <div className="progress-bar-wrapper">
          <div className="progress-bar-background" aria-hidden="true">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="timeline-progress-meta" aria-label={`Progreso ${progress}%`}>
            <span>Inicio</span>
            <span className="timeline-progress-value">{progress}%</span>
            <span>Completado</span>
          </div>
        </div>

        <div className="timeline-current-state-card">
          <div className="timeline-current-state-card__label">Estado actual</div>

          <div
            className="timeline-current-state-card__value"
            title={currentStep}
          >
            {currentStep}
          </div>

          <div className="timeline-current-state-card__hint">
            Próximo paso: <span title={nextStep}>{nextStep}</span>
          </div>
        </div>
      </div>

      <div className="timeline-events">
        {!hasEvents ? (
          <div className="timeline-empty-state">
            Este documento todavía no tiene eventos para mostrar.
          </div>
        ) : (
          events.map((event, index) => {
            const status = getEventStatus(index, events.length);
            const isLast = index === events.length - 1;
            const title = getEventTitle(event);
            const detailsText = formatDetails(event);
            const timestampText = formatTimestamp(event?.timestamp);
            const audit = isAuditEvent(event);
            const actorLabel = getActorLabel(event);
            const { ip, userAgent, requestId } = getAuditMeta(event);

            return (
              <div
                key={getStableEventKey(event, index)}
                className="timeline-event-wrapper"
              >
                {!isLast && (
                  <div
                    className={`timeline-line timeline-line-${status}`}
                    aria-hidden="true"
                  />
                )}

                <div
                  className={`timeline-dot timeline-dot-${status}`}
                  aria-hidden="true"
                >
                  <span className="timeline-icon">{getEventIcon(event)}</span>
                </div>

                <div className={`timeline-content timeline-content-${status}`}>
                  <h4 className="timeline-event-title" title={title}>
                    {title}
                  </h4>

                  {detailsText && (
                    <p className="timeline-event-details" title={detailsText}>
                      {detailsText}
                    </p>
                  )}

                  {timestampText && (
                    <p className="timeline-event-timestamp">{timestampText}</p>
                  )}

                  {actorLabel && (
                    <p
                      className={`timeline-event-actor ${
                        audit
                          ? "timeline-event-actor--audit"
                          : "timeline-event-actor--user"
                      }`}
                      title={actorLabel}
                    >
                      {audit ? "Sistema / Auditoría:" : "Por:"} {actorLabel}
                    </p>
                  )}

                  {audit && (ip || userAgent || requestId) && (
                    <div className="timeline-audit-meta">
                      {ip && <div title={ip}>IP: {ip}</div>}

                      {userAgent && (
                        <div className="timeline-ellipsis" title={userAgent}>
                          Agente: {userAgent}
                        </div>
                      )}

                      {requestId && (
                        <div title={requestId}>Req ID: {requestId}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}