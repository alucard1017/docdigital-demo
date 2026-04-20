// frontend/src/utils/documentEvents.js

/* ============================
   Helpers básicos
   ============================ */

export function normalizeText(value = "") {
  return String(value ?? "").trim();
}

export function normalizeUpper(value = "") {
  return normalizeText(value).toUpperCase();
}

export function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimelineTimestamp(value) {
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

export function clampProgress(value) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

export function ellipsisMiddle(value = "", max = 48) {
  const text = normalizeText(value);
  if (!text || text.length <= max) return text;

  const left = Math.ceil(max * 0.55);
  const right = Math.floor(max * 0.25);
  return `${text.slice(0, left)}…${text.slice(text.length - right)}`;
}

export function shortenUserAgent(value = "", max = 72) {
  const text = normalizeText(value);
  if (!text) return "";

  const simplified = text
    .replace(/\s+/g, " ")
    .replace(/Mozilla\/5\.0/gi, "Mozilla")
    .trim();

  return simplified.length > max
    ? `${simplified.slice(0, max)}…`
    : simplified;
}

export function safeJsonPreview(value, maxLength = 180) {
  try {
    const text = JSON.stringify(value);
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    return "";
  }
}

/* ============================
   Estados
   ============================ */

export function normalizeStatus(value) {
  const text = normalizeUpper(value);

  if (text === "BORRADOR" || text === "DRAFT") return "DRAFT";
  if (text === "PENDIENTE_FIRMA" || text === "PENDING_SIGNATURE") {
    return "PENDING_SIGNATURE";
  }
  if (text === "FIRMADO" || text === "SIGNED") return "SIGNED";
  if (text === "RECHAZADO" || text === "REJECTED") return "REJECTED";

  return "UNKNOWN";
}

/* ============================
   Lectura raw (contrato backend)
   ============================ */

export function getRawTimestamp(raw) {
  return (
    raw?.createdAt ||
    raw?.created_at ||
    raw?.timestamp ||
    raw?.date ||
    null
  );
}

export function getRawEventType(raw) {
  return normalizeUpper(raw?.eventType || raw?.event_type);
}

export function getRawAction(raw) {
  return normalizeText(raw?.action || raw?.metadata?.action);
}

export function getRawSource(raw) {
  // backend mete source en metadata.source
  return normalizeText(
    raw?.source ||
      raw?.metadata?.source ||
      raw?.metadata?.fuente ||
      raw?.metadata?.origin
  ).toLowerCase();
}

export function getRawIp(raw) {
  return (
    normalizeText(raw?.ip) ||
    normalizeText(raw?.ipAddress) ||
    normalizeText(raw?.ip_address) ||
    normalizeText(raw?.metadata?.ip) ||
    ""
  );
}

export function getRawUserAgent(raw) {
  return (
    normalizeText(raw?.userAgent) ||
    normalizeText(raw?.user_agent) ||
    normalizeText(raw?.metadata?.user_agent) ||
    ""
  );
}

export function getRawRequestId(raw) {
  return (
    normalizeText(raw?.requestId) ||
    normalizeText(raw?.request_id) ||
    normalizeText(raw?.metadata?.request_id) ||
    ""
  );
}

export function getMetadataActorType(raw) {
  return normalizeUpper(raw?.metadata?.actor_type || raw?.metadata?.actorType);
}

/* ============================
   Clasificación
   ============================ */

export function isAuditEvent(raw) {
  const source = getRawSource(raw);
  const eventType = getRawEventType(raw);
  return (
    source === "audit_log" ||
    source === "audit" ||
    eventType.startsWith("AUDIT_")
  );
}

export function isSystemEvent(raw) {
  const actor = normalizeText(raw?.actor).toLowerCase();
  const source = getRawSource(raw);
  const eventType = getRawEventType(raw);
  const metadataActorType = getMetadataActorType(raw);

  if (isAuditEvent(raw)) return true;
  if (actor === "system" || actor === "sistema") return true;
  if (source === "system" || source === "backend" || source === "api") {
    return true;
  }
  if (metadataActorType === "SYSTEM" || metadataActorType === "AUDIT") {
    return true;
  }

  if (
    eventType === "DOCUMENT_CREATED" ||
    eventType === "DOCUMENT_SENT" ||
    eventType === "DOCUMENT_COMPLETED"
  ) {
    return true;
  }

  return false;
}

export function getActorType(raw) {
  if (isAuditEvent(raw)) return "audit";
  if (isSystemEvent(raw)) return "system";
  return "user";
}

export function getEventKind(raw) {
  const eventType = getRawEventType(raw);

  if (eventType === "DOCUMENT_CREATED") return "created";
  if (eventType === "DOCUMENT_SENT") return "sent";
  if (eventType === "PUBLIC_LINK_OPENED_SIGNER") return "opened";
  if (eventType === "INVITATION_OPENED") return "opened";
  if (
    eventType === "SIGNED_OWNER" ||
    eventType === "SIGNED_PUBLIC" ||
    eventType === "DOCUMENT_SIGNED" ||
    eventType === "SIGNED_INTERNAL"
  ) {
    return "signed";
  }
  if (
    eventType === "VISADO_OWNER" ||
    eventType === "VISADO_PUBLIC" ||
    eventType === "VISADO_INTERNAL" ||
    eventType.includes("REVIEWED")
  ) {
    return "approved";
  }
  if (
    eventType === "REJECTED_OWNER" ||
    eventType === "REJECTED_PUBLIC" ||
    eventType.includes("REJECTED")
  ) {
    return "rejected";
  }
  if (eventType === "DOCUMENT_COMPLETED") return "completed";
  if (eventType.includes("VERIFY") || eventType.includes("VERIFIED")) {
    return "verified";
  }
  if (isAuditEvent(raw)) return "audit";
  if (isSystemEvent(raw)) return "system";

  return "generic";
}

export function getEventIconByKind(kind) {
  switch (kind) {
    case "created":
      return "📄";
    case "sent":
      return "📨";
    case "opened":
      return "🔓";
    case "approved":
      return "👁";
    case "signed":
      return "✍";
    case "rejected":
      return "✕";
    case "completed":
      return "✓";
    case "verified":
      return "🔍";
    case "audit":
      return "📝";
    case "system":
      return "⚙";
    default:
      return "◉";
  }
}

export function getEventTitle(raw, kind = getEventKind(raw)) {
  switch (kind) {
    case "created":
      return "Documento creado";
    case "sent":
      return "Documento enviado";
    case "opened": {
      const linkType = normalizeText(raw?.metadata?.link_type);
      if (linkType === "signer_token") return "Enlace de firma abierto";
      if (linkType === "document_token") return "Documento público abierto";
      return "Acceso al documento";
    }
    case "approved":
      return "Documento visado";
    case "signed":
      return "Firma registrada";
    case "rejected":
      return "Documento rechazado";
    case "completed":
      return "Documento completado";
    case "verified":
      return "Verificación de documento";
    case "audit":
      return "Registro de auditoría";
    case "system":
      return "Evento del sistema";
    default:
      return getRawEventType(raw) || getRawAction(raw) || "Evento";
  }
}

/* ============================
   Textos y display
   ============================ */

export function buildMetadataSummary(metadata) {
  if (!isObject(metadata)) return "";

  const {
    document_id,
    documentId,
    document_title,
    documentTitle,
    title,
    from_status,
    fromStatus,
    to_status,
    toStatus,
    status,
    documentStatus,
    reason,
    link_type,
    actor_type,
    signer_name,
    owner_name,
    signer_email,
    numero_contrato_interno,
    ...rest
  } = metadata;

  const docTitle =
    title ||
    documentTitle ||
    document_title ||
    documentId ||
    document_id ||
    "";

  const from = fromStatus || from_status || "";
  const to = toStatus || to_status || status || documentStatus || "";

  const parts = [];

  if (docTitle) parts.push(`Documento: ${docTitle}`);
  if (numero_contrato_interno)
    parts.push(`Contrato: ${numero_contrato_interno}`);
  if (from && to) {
    parts.push(`Estado: ${from} → ${to}`);
  } else if (to) {
    parts.push(`Estado: ${to}`);
  }
  if (reason) parts.push(`Motivo: ${reason}`);
  if (link_type) parts.push(`Link: ${link_type}`);
  if (actor_type) parts.push(`Actor: ${actor_type}`);
  if (signer_name) parts.push(`Firmante: ${signer_name}`);
  if (owner_name) parts.push(`Responsable: ${owner_name}`);
  if (signer_email) parts.push(`Email: ${signer_email}`);

  if (Object.keys(rest).length > 0) {
    const extra = safeJsonPreview(rest, 120);
    if (extra) parts.push(`Extra: ${extra}`);
  }

  return parts.join(" · ");
}

export function getHumanDetails(raw, kind = getEventKind(raw)) {
  const direct = normalizeText(raw?.details || raw?.description);
  if (direct) return direct;

  if (kind === "created") return "Se creó el documento.";
  if (kind === "sent") return "Se envió el documento para firma.";

  if (kind === "opened") {
    const linkType = normalizeText(raw?.metadata?.link_type);
    const actorType = normalizeUpper(raw?.metadata?.actor_type);
    const actor = normalizeText(raw?.actor);

    if (linkType === "signer_token") {
      return actor
        ? `${actor} abrió el enlace de firma.`
        : "Se abrió el enlace de firma.";
    }

    if (linkType === "document_token" && actorType === "PUBLIC_VIEWER") {
      return "Se abrió el acceso público al documento.";
    }

    return "Se registró una apertura del enlace/documento.";
  }

  if (kind === "rejected") {
    const reason = normalizeText(raw?.metadata?.reason);
    if (reason) return `Documento rechazado. Motivo: ${reason}`;
    return "Documento rechazado.";
  }

  const fromStatus = normalizeText(raw?.fromStatus || raw?.from_status);
  const toStatus = normalizeText(raw?.toStatus || raw?.to_status);

  if (fromStatus && toStatus) {
    return `Cambio de estado: ${fromStatus} → ${toStatus}`;
  }

  return buildMetadataSummary(raw?.metadata);
}

// Nombre legible del actor (string) para la UI
export function getActorLabel(raw) {
  // Primero, actor directo
  const actorDirect = normalizeText(raw?.actor);
  if (actorDirect) {
    const lower = actorDirect.toLowerCase();
    if (lower === "public_user") return "Usuario público";
    if (lower === "system" || lower === "sistema") return "Sistema";
    return actorDirect;
  }

  // Luego, metadata
  const meta = raw?.metadata || {};
  const signerName = normalizeText(meta.signer_name);
  const ownerName = normalizeText(meta.owner_name);
  const signerEmail = normalizeText(meta.signer_email);

  if (signerName) return signerName;
  if (ownerName) return ownerName;
  if (signerEmail) return signerEmail;

  if (isAuditEvent(raw)) return "Sistema / Auditoría";
  if (isSystemEvent(raw)) return "Sistema";

  return "";
}

export function shouldShowTechMeta(kind, raw) {
  if (isAuditEvent(raw)) return true;

  return (
    kind === "signed" ||
    kind === "rejected" ||
    kind === "verified" ||
    kind === "opened"
  );
}

export function getBadgeLabel(actorType) {
  if (actorType === "audit") return "Auditoría";
  if (actorType === "system") return "Sistema";
  return "Usuario";
}

export function getBadgeClass(actorType) {
  if (actorType === "audit") return "timeline-event-badge--audit";
  if (actorType === "system") return "timeline-event-badge--system";
  return "timeline-event-badge--user";
}

/* ============================
   Mapping principal (backend → UI)
   ============================ */

export function mapDocumentEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  const kind = getEventKind(raw);
  const actorType = getActorType(raw);
  const timestampRaw = getRawTimestamp(raw);
  const timestamp = toValidDate(timestampRaw);

  const fromStatus = raw?.fromStatus ?? raw?.from_status ?? null;
  const toStatus = raw?.toStatus ?? raw?.to_status ?? null;

  const actorLabel = getActorLabel(raw);

  return {
    id: raw?.id ?? null,
    documentId: raw?.documentId ?? raw?.document_id ?? null,
    eventType: getRawEventType(raw),
    actionRaw: getRawAction(raw),
    title: getEventTitle(raw, kind),
    kind,
    icon: getEventIconByKind(kind),
    actor: actorLabel, // string legible (Sistema, Juan, etc.)
    actorType, // "system" | "user" | "audit"
    fromStatus,
    toStatus,
    fromStatusNorm: normalizeStatus(fromStatus),
    toStatusNorm: normalizeStatus(toStatus),
    ip: getRawIp(raw) || null,
    userAgent: getRawUserAgent(raw) || null,
    requestId: getRawRequestId(raw) || null,
    createdAt: timestampRaw || null,
    timestamp,
    details: getHumanDetails(raw, kind),
    metadata: isObject(raw?.metadata) ? raw.metadata : null,
    showTechMeta: shouldShowTechMeta(kind, raw),
  };
}

export function getStableEventKey(event) {
  if (event?.id != null) return `event-${event.id}`;

  const parts = [
    normalizeText(event?.documentId) || "doc",
    normalizeText(event?.eventType) || "type",
    normalizeText(event?.createdAt) || "ts",
    normalizeText(event?.actor) || "actor",
  ];

  return parts.join("-");
}

export function getEventVisualStatus(index, total) {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
    return "pending";
  }

  if (index < total - 1) return "completed";
  if (index === total - 1) return "active";
  return "pending";
}

/* ============================
   Normalización del timeline
   ============================ */

export function normalizeTimeline(rawTimeline) {
  // backend responde:
  // - getTimeline: { document, participants, timeline: { events, progress, currentStep, nextStep } }
  // - getLegalTimeline: { document, events }
  const rawEvents =
    (Array.isArray(rawTimeline?.events) && rawTimeline.events) ||
    (Array.isArray(rawTimeline?.timeline?.events) &&
      rawTimeline.timeline.events) ||
    [];

  const mappedEvents = (Array.isArray(rawEvents) ? rawEvents : [])
    .map(mapDocumentEvent)
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.timestamp ? a.timestamp.getTime() : 0;
      const bTime = b?.timestamp ? b.timestamp.getTime() : 0;
      return aTime - bTime;
    });

  const rawProgress =
    rawTimeline?.progress ?? rawTimeline?.timeline?.progress ?? 0;

  const rawCurrentStep =
    rawTimeline?.currentStep ??
    rawTimeline?.timeline?.currentStep ??
    rawTimeline?.currentStatus ??
    rawTimeline?.timeline?.currentStatus;

  const rawNextStep =
    rawTimeline?.nextStep ?? rawTimeline?.timeline?.nextStep;

  return {
    events: mappedEvents,
    hasEvents: mappedEvents.length > 0,
    progress: clampProgress(rawProgress),
    currentStep:
      normalizeText(rawCurrentStep) || "En curso",
    nextStep:
      normalizeText(rawNextStep) || "Por definir",
  };
}