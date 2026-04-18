// frontend/src/components/Timeline.jsx
import React, { useMemo } from "react";
import "./Timeline.css";
import {
  ellipsisMiddle,
  formatTimelineTimestamp,
  getBadgeClass,
  getBadgeLabel,
  getEventVisualStatus,
  getStableEventKey,
  isObject,
  normalizeTimeline,
  shortenUserAgent,
} from "../utils/documentEvents";

function getActorPrefix(actorType) {
  return actorType === "user" ? "Por:" : "Origen:";
}

export function Timeline({ timeline }) {
  const hasTimelineObject = isObject(timeline);

  const { events, hasEvents, progress, currentStep, nextStep } = useMemo(
    () => normalizeTimeline(timeline || {}),
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
    <section className="timeline-container" aria-label="Timeline del documento">
      <header className="timeline-header">
        <h3 className="timeline-heading">Progreso del documento</h3>

        <div className="progress-bar-wrapper">
          <div
            className="progress-bar-background"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={`Progreso del documento ${progress}%`}
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="timeline-progress-meta">
            <span>Inicio</span>
            <span className="timeline-progress-value">{progress}%</span>
            <span>Completado</span>
          </div>
        </div>

        <div className="timeline-current-state-card">
          <div className="timeline-current-state-card__label">
            Estado actual
          </div>

          <div
            className="timeline-current-state-card__value"
            title={currentStep || ""}
          >
            {currentStep || "—"}
          </div>

          <div className="timeline-current-state-card__hint">
            Próximo paso:{" "}
            <span title={nextStep || ""}>{nextStep || "Sin definir"}</span>
          </div>
        </div>
      </header>

      <div className="timeline-events">
        {!hasEvents ? (
          <div className="timeline-empty-state">
            Este documento todavía no tiene eventos para mostrar.
          </div>
        ) : (
          events.map((event, index) => {
            const visualStatus = getEventVisualStatus(index, events.length);
            const isLast = index === events.length - 1;

            const badgeLabel = getBadgeLabel(event.actorType);
            const badgeClass = getBadgeClass(event.actorType);
            const actorType = event.actorType; // "system" | "user" | "audit"
            const actorLabel = event.actor;    // string ya normalizado

            return (
              <article
                key={getStableEventKey(event)}
                className={`timeline-event-wrapper timeline-event--${event.kind}`}
              >
                {!isLast && (
                  <div
                    className={`timeline-line timeline-line-${visualStatus}`}
                    aria-hidden="true"
                  />
                )}

                <div
                  className={`timeline-dot timeline-dot-${visualStatus}`}
                  aria-hidden="true"
                >
                  <span className="timeline-icon">{event.icon}</span>
                </div>

                <div
                  className={`timeline-content timeline-content-${visualStatus}`}
                >
                  <div className="timeline-event-top">
                    <h4
                      className="timeline-event-title"
                      title={event.title || ""}
                    >
                      {event.title}
                    </h4>

                    <span
                      className={`timeline-event-badge ${badgeClass}`}
                      title={`Tipo de actor: ${badgeLabel}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {event.details && (
                    <p className="timeline-event-details" title={event.details}>
                      {event.details}
                    </p>
                  )}

                  {event.createdAt && (
                    <p className="timeline-event-timestamp">
                      {formatTimelineTimestamp(event.createdAt)}
                    </p>
                  )}

                  {actorLabel && (
                    <p
                      className={`timeline-event-actor timeline-event-actor--${actorType}`}
                      title={actorLabel}
                    >
                      {getActorPrefix(actorType)} {actorLabel}
                    </p>
                  )}

                  {event.showTechMeta &&
                    (event.ip || event.userAgent || event.requestId) && (
                      <div className="timeline-audit-meta">
                        {event.ip && (
                          <div title={event.ip}>
                            IP: {ellipsisMiddle(event.ip, 28)}
                          </div>
                        )}

                        {event.userAgent && (
                          <div title={event.userAgent}>
                            Agente: {shortenUserAgent(event.userAgent, 68)}
                          </div>
                        )}

                        {event.requestId && (
                          <div title={event.requestId}>
                            Req ID: {ellipsisMiddle(event.requestId, 32)}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default Timeline;