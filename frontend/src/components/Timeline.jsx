// src/components/Timeline.jsx
import React, { memo, useMemo } from "react";
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

function hasStatusTransition(event) {
  return Boolean(event?.fromStatus || event?.toStatus);
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function isSignedStatus(value) {
  return normalizeStatus(value) === "FIRMADO";
}

function isRejectedStatus(value) {
  return normalizeStatus(value) === "RECHAZADO";
}

function clampProgress(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function getTimelineHint(currentStep, nextStep) {
  const normalizedCurrentStep = normalizeStatus(currentStep);
  const flujoFirmado = isSignedStatus(normalizedCurrentStep);
  const flujoRechazado = isRejectedStatus(normalizedCurrentStep);

  if (flujoFirmado) {
    return {
      label: "Resultado del flujo",
      value: "✅ Flujo completado",
    };
  }

  if (flujoRechazado) {
    return {
      label: "Resultado del flujo",
      value: "❌ Flujo cerrado por rechazo",
    };
  }

  return {
    label: "Próximo paso",
    value: nextStep || "Sin definir",
  };
}

function StatusTransition({ event }) {
  if (!hasStatusTransition(event)) return null;

  const from = event.fromStatus || "Sin estado";
  const to = event.toStatus || "Sin estado";

  return (
    <div className="timeline-event-status-change" title={`${from} → ${to}`}>
      <span className="timeline-event-status timeline-event-status--from">
        {from}
      </span>

      <span className="timeline-event-status-arrow" aria-hidden="true">
        →
      </span>

      <span className="timeline-event-status timeline-event-status--to">
        {to}
      </span>
    </div>
  );
}

const EventTechMeta = memo(function EventTechMeta({ event }) {
  if (!event?.showTechMeta) return null;
  if (!event.ip && !event.userAgent && !event.requestId) return null;

  return (
    <div
      className="timeline-audit-meta"
      aria-label="Metadatos técnicos del evento"
    >
      {event.ip ? (
        <div title={event.ip}>IP: {ellipsisMiddle(event.ip, 28)}</div>
      ) : null}

      {event.userAgent ? (
        <div title={event.userAgent}>
          Agente: {shortenUserAgent(event.userAgent, 68)}
        </div>
      ) : null}

      {event.requestId ? (
        <div title={event.requestId}>
          Req ID: {ellipsisMiddle(event.requestId, 32)}
        </div>
      ) : null}
    </div>
  );
});

const TimelineEventCard = memo(function TimelineEventCard({
  event,
  index,
  total,
}) {
  const visualStatus = getEventVisualStatus(index, total);
  const isLast = index === total - 1;

  const badgeLabel = getBadgeLabel(event?.actorType);
  const badgeClass = getBadgeClass(event?.actorType);
  const actorType = event?.actorType || "system";
  const actorLabel = event?.actor;

  return (
    <article
      className={`timeline-event-wrapper timeline-event--${
        event?.kind || "default"
      }`}
      aria-label={event?.title || "Evento del timeline"}
    >
      {!isLast ? (
        <div
          className={`timeline-line timeline-line-${visualStatus}`}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`timeline-dot timeline-dot-${visualStatus}`}
        aria-hidden="true"
      >
        <span className="timeline-icon">{event?.icon}</span>
      </div>

      <div className={`timeline-content timeline-content-${visualStatus}`}>
        <div className="timeline-event-top">
          <h4 className="timeline-event-title" title={event?.title || ""}>
            {event?.title || "Evento"}
          </h4>

          <span
            className={`timeline-event-badge ${badgeClass}`}
            title={`Tipo de actor: ${badgeLabel}`}
          >
            {badgeLabel}
          </span>
        </div>

        {event?.details ? (
          <p className="timeline-event-details" title={event.details}>
            {event.details}
          </p>
        ) : null}

        <StatusTransition event={event} />

        <div className="timeline-event-meta-row">
          {event?.createdAt ? (
            <p className="timeline-event-timestamp">
              {formatTimelineTimestamp(event.createdAt)}
            </p>
          ) : null}

          {actorLabel ? (
            <p
              className={`timeline-event-actor timeline-event-actor--${actorType}`}
              title={actorLabel}
            >
              {getActorPrefix(actorType)} {actorLabel}
            </p>
          ) : null}
        </div>

        <EventTechMeta event={event} />
      </div>
    </article>
  );
});

function TimelineHeader({ progress, currentStep, nextStep }) {
  const safeProgress = clampProgress(progress);
  const hint = getTimelineHint(currentStep, nextStep);

  return (
    <header className="timeline-header">
      <h3 className="timeline-heading">Progreso del documento</h3>

      <div className="progress-bar-wrapper">
        <div
          className="progress-bar-background"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
          aria-valuetext={`${safeProgress}% completado`}
          aria-label={`Progreso del documento ${safeProgress}%`}
        >
          <div
            className="progress-bar-fill"
            style={{ width: `${safeProgress}%` }}
          />
        </div>

        <div className="timeline-progress-meta">
          <span>Inicio</span>
          <span className="timeline-progress-value">{safeProgress}%</span>
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
          {hint.label}: <span title={hint.value}>{hint.value}</span>
        </div>
      </div>
    </header>
  );
}

function TimelineBody({ events, hasEvents }) {
  if (!hasEvents) {
    return (
      <div className="timeline-empty-state" role="status" aria-live="polite">
        Este documento todavía no tiene eventos para mostrar.
      </div>
    );
  }

  return events.map((event, index) => (
    <TimelineEventCard
      key={getStableEventKey(event)}
      event={event}
      index={index}
      total={events.length}
    />
  ));
}

export function Timeline({ timeline }) {
  const hasTimelineObject = isObject(timeline);

  const normalizedTimeline = useMemo(
    () => normalizeTimeline(hasTimelineObject ? timeline : {}),
    [hasTimelineObject, timeline]
  );

  const {
    events = [],
    hasEvents = false,
    progress = 0,
    currentStep = "",
    nextStep = "",
  } = normalizedTimeline;

  if (!hasTimelineObject) {
    return (
      <div className="timeline-empty-state" role="status" aria-live="polite">
        Cargando historial del documento…
      </div>
    );
  }

  return (
    <section className="timeline-container" aria-label="Timeline del documento">
      <TimelineHeader
        progress={progress}
        currentStep={currentStep}
        nextStep={nextStep}
      />

      <div className="timeline-events">
        <TimelineBody events={events} hasEvents={hasEvents} />
      </div>
    </section>
  );
}

export default memo(Timeline);