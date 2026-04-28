// src/components/Timeline.jsx
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  normalizeStatus,
  clampProgress,
} from "../utils/documentEvents";

function getActorPrefix(actorType, t) {
  return actorType === "user"
    ? t("timeline.actorPrefix.user", "Por:")
    : t("timeline.actorPrefix.system", "Origen:");
}

function hasStatusTransition(event) {
  return Boolean(event?.fromStatus || event?.toStatus);
}

function isSignedStatus(value) {
  return normalizeStatus(value) === "SIGNED";
}

function isRejectedStatus(value) {
  return normalizeStatus(value) === "REJECTED";
}

function getTimelineHint(currentStep, nextStep, t) {
  const normalizedCurrentStep = normalizeStatus(currentStep);
  const flujoFirmado = isSignedStatus(normalizedCurrentStep);
  const flujoRechazado = isRejectedStatus(normalizedCurrentStep);

  if (flujoFirmado) {
    return {
      label: t("timeline.hint.resultLabel", "Resultado del flujo"),
      value: t("timeline.hint.completed", "✅ Flujo completado"),
    };
  }

  if (flujoRechazado) {
    return {
      label: t("timeline.hint.resultLabel", "Resultado del flujo"),
      value: t("timeline.hint.rejected", "❌ Flujo cerrado por rechazo"),
    };
  }

  return {
    label: t("timeline.hint.nextStepLabel", "Próximo paso"),
    value: nextStep || t("timeline.hint.undefined", "Sin definir"),
  };
}

function StatusTransition({ event }) {
  const { t } = useTranslation();

  if (!hasStatusTransition(event)) return null;

  const from = event.fromStatus || t("timeline.status.noStatus", "Sin estado");
  const to = event.toStatus || t("timeline.status.noStatus", "Sin estado");

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
  const { t } = useTranslation();

  if (!event?.showTechMeta) return null;
  if (!event.ip && !event.userAgent && !event.requestId) return null;

  return (
    <div
      className="timeline-audit-meta"
      aria-label={t(
        "timeline.techMeta.ariaLabel",
        "Metadatos técnicos del evento"
      )}
    >
      {event.ip ? (
        <div title={event.ip}>
          {t("timeline.techMeta.ip", "IP")}: {ellipsisMiddle(event.ip, 28)}
        </div>
      ) : null}

      {event.userAgent ? (
        <div title={event.userAgent}>
          {t("timeline.techMeta.userAgent", "Agente")}:{" "}
          {shortenUserAgent(event.userAgent, 68)}
        </div>
      ) : null}

      {event.requestId ? (
        <div title={event.requestId}>
          {t("timeline.techMeta.requestId", "Req ID")}:{" "}
          {ellipsisMiddle(event.requestId, 32)}
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
  const { t } = useTranslation();
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
      aria-label={event?.title || t("timeline.event.defaultTitle", "Evento del timeline")}
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
            {event?.title || t("timeline.event.defaultTitle", "Evento")}
          </h4>

          <span
            className={`timeline-event-badge ${badgeClass}`}
            title={t("timeline.event.actorTypeTitle", "Tipo de actor: {{type}}", {
              type: badgeLabel,
            })}
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
              {getActorPrefix(actorType, t)} {actorLabel}
            </p>
          ) : null}
        </div>

        <EventTechMeta event={event} />
      </div>
    </article>
  );
});

function TimelineHeader({ progress, currentStep, nextStep }) {
  const { t } = useTranslation();
  const safeProgress = clampProgress(progress);
  const hint = getTimelineHint(currentStep, nextStep, t);

  return (
    <header className="timeline-header">
      <h3 className="timeline-heading">
        {t("timeline.header.title", "Progreso del documento")}
      </h3>

      <div className="progress-bar-wrapper">
        <div
          className="progress-bar-background"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
          aria-valuetext={t("timeline.header.progressText", "{{progress}}% completado", {
            progress: safeProgress,
          })}
          aria-label={t("timeline.header.progressLabel", "Progreso del documento {{progress}}%", {
            progress: safeProgress,
          })}
        >
          <div
            className="progress-bar-fill"
            style={{ width: `${safeProgress}%` }}
          />
        </div>

        <div className="timeline-progress-meta">
          <span>{t("timeline.header.start", "Inicio")}</span>
          <span className="timeline-progress-value">{safeProgress}%</span>
          <span>{t("timeline.header.completed", "Completado")}</span>
        </div>
      </div>

      <div className="timeline-current-state-card">
        <div className="timeline-current-state-card__label">
          {t("timeline.header.currentState", "Estado actual")}
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
  const { t } = useTranslation();

  if (!hasEvents) {
    return (
      <div className="timeline-empty-state" role="status" aria-live="polite">
        {t(
          "timeline.empty.noEvents",
          "Este documento todavía no tiene eventos para mostrar."
        )}
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
  const { t } = useTranslation();
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
        {t("timeline.empty.loading", "Cargando historial del documento…")}
      </div>
    );
  }

  return (
    <section
      className="timeline-container"
      aria-label={t("timeline.ariaLabel", "Timeline del documento")}
    >
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