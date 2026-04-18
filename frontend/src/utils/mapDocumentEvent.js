// frontend/src/utils/mapDocumentEvent.js

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

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/* Estados normalizados */

function normalizeStatus(value) {
  const text = normalizeUpper(value);

  if (text === "BORRADOR" || text === "DRAFT") return "DRAFT";
  if (text === "PENDIENTE_FIRMA" || text === "PENDING_SIGNATURE") {
    return "PENDING_SIGNATURE";
  }
  if (text === "FIRMADO" || text === "SIGNED") return "SIGNED";
  if (text === "RECHAZADO" || text === "REJECTED") return "REJECTED";

  return "UNKNOWN";
}

/* Campos base */

function getEventTimestamp(raw) {
  return (
    raw?.createdAt ||
    raw?.created_at ||
    raw?.timestamp ||
    raw?.date ||
    null
  );
}

function getEventType(raw) {
  return normalizeUpper(raw?.eventType || raw?.event_type);
}

function getActionRaw(raw) {
  return (
    normalizeText(raw?.action) ||
    normalizeText(raw?.metadata?.action) ||
    ""
  );
}

function getSource(raw) {
  return normalizeText(
    raw?.source ||
      raw?.metadata?.source ||
      raw?.metadata?.fuente ||
      raw?.metadata?.origin
  ).toLowerCase();
}

function getActorTypeFromMetadata(raw) {
  const metaType = normalizeUpper(
    raw?.metadata?.actor_type || raw?.metadata?.actorType
  );

  if (!metaType) return null;

  if (
    metaType === "OWNER" ||
    metaType === "PUBLIC_SIGNER" ||
    metaType === "PUBLIC_VIEWER"
  ) {
    return "user";
  }

  if (metaType === "SYSTEM" || metaType === "AUDIT_LOG" || metaType === "AUDIT") {
    return "system";
  }

  return null;
}

/* Audit / system detection */

function isAuditEvent(raw) {
  const source = getSource(raw);
  return source === "audit_log" || source === "audit";
}

function isSystemEvent(raw) {
  const actor = normalizeText(raw?.actor).toLowerCase();
  const source = getSource(raw);
  const eventType = getEventType(raw);

  if (isAuditEvent(raw)) return true;
  if (actor === "system" || actor === "sistema") return true;
  if (source === "system" || source === "backend" || source === "api") {
    return true;
  }

  const metaActorType = getActorTypeFromMetadata(raw);
  if (metaActorType === "system") return true;

  // Eventos típicamente de sistema
  if (
    eventType === "DOCUMENT_CREATED" ||
    eventType === "DOCUMENT_SENT" ||
    eventType === "DOCUMENT_COMPLETED"
  ) {
    return true;
  }

  return false;
}

function isHumanEvent(raw) {
  if (isSystemEvent(raw)) return false;

  const metaActorType = getActorTypeFromMetadata(raw);
  if (metaActorType === "user") return true;

  const actor = normalizeText(raw?.actor);
  if (!actor) return false;

  // Si parece nombre humano, lo tratamos como usuario
  if (actor.toLowerCase() === "public_user") return true;
  return true;
}

function getActorType(raw) {
  if (isAuditEvent(raw)) return "audit";
  if (isSystemEvent(raw)) return "system";
  if (isHumanEvent(raw)) return "user";
  return "system";
}

/* Kind semántico */

function getEventKind(raw) {
  const eventType = getEventType(raw);

  if (eventType === "DOCUMENT_CREATED") return "created";
  if (eventType === "DOCUMENT_SENT") return "sent";
  if (eventType === "PUBLIC_LINK_OPENED_SIGNER") return "opened";
  if (eventType === "INVITATION_OPENED") return "opened";
  if (eventType === "DOCUMENT_SIGNED" || eventType.endsWith("_SIGNED")) {
    return "signed";
  }
  if (eventType === "REJECTED_OWNER" || eventType.includes("REJECTED")) {
    return "rejected";
  }
  if (eventType === "DOCUMENT_COMPLETED") return "completed";
  if (eventType.includes("VERIFY")) return "verified";
  if (isAuditEvent(raw)) return "audit";
  if (isSystemEvent(raw)) return "system";

  return "generic";
}

/* Título y detalles */

function getEventTitle(raw) {
  const kind = getEventKind(raw);

  switch (kind) {
    case "created":
      return "Documento creado";
    case "sent":
      return "Documento enviado";
    case "opened":
      return "Acceso al documento";
    case "signed":
      return "Documento firmado";
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
    default: {
      const eventType = getEventType(raw);
      return eventType || "Evento";
    }
  }
}

function buildMetadataSummary(metadata) {
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
    ...rest
  } = metadata;

  const docTitle =
    title || documentTitle || document_title || documentId || document_id || "";

  const from = fromStatus || from_status || "";
  const to = toStatus || to_status || status || documentStatus || "";

  const parts = [];

  if (docTitle) parts.push(`Documento: ${docTitle}`);
  if (from && to) {
    parts.push(`Estado: ${from} → ${to}`);
  } else if (to) {
    parts.push(`Estado: ${to}`);
  }

  if (reason) parts.push(`Motivo: ${reason}`);
  if (link_type) parts.push(`Link: ${link_type}`);
  if (actor_type) parts.push(`Actor: ${actor_type}`);

  if (Object.keys(rest).length > 0) {
    parts.push(`Extra: ${JSON.stringify(rest)}`);
  }

  return parts.join(" · ");
}

function getDetails(raw) {
  const direct = normalizeText(raw?.details || raw?.description);
  if (direct) return direct;

  const metadataSummary = buildMetadataSummary(raw?.metadata);
  if (metadataSummary) return metadataSummary;

  const eventType = getEventType(raw);
  if (eventType === "DOCUMENT_CREATED") return "Se creó el documento.";
  if (eventType === "DOCUMENT_SENT") return "Se envió el documento para firma.";
  if (eventType === "REJECTED_OWNER") {
    const reason = raw?.metadata?.reason || "";
    return reason
      ? `Documento rechazado por el propietario. Motivo: ${reason}`
      : "Documento rechazado por el propietario.";
  }

  return "";
}

/* Actor display */

function getActor(raw) {
  const actor = normalizeText(raw?.actor);

  if (actor) {
    if (actor.toLowerCase() === "public_user") return "Usuario público";
    if (actor.toLowerCase() === "system") return "Sistema";
    return actor;
  }

  if (isAuditEvent(raw)) return "Sistema / Auditoría";
  if (isSystemEvent(raw)) return "Sistema";

  return "";
}

/* IP / user agent */

function getIp(raw) {
  return (
    normalizeText(raw?.ip) ||
    normalizeText(raw?.ip_address) ||
    normalizeText(raw?.ipAddress) ||
    ""
  );
}

function getUserAgent(raw) {
  return (
    normalizeText(raw?.userAgent) ||
    normalizeText(raw?.user_agent) ||
    normalizeText(raw?.metadata?.user_agent) ||
    ""
  );
}

/* Mapper principal */

export function mapDocumentEvent(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = raw.id ?? null;
  const documentId = raw.document_id ?? raw.documentId ?? null;
  const eventType = getEventType(raw);
  const actionRaw = getActionRaw(raw);
  const kind = getEventKind(raw);
  const actorType = getActorType(raw);
  const actor = getActor(raw);

  const fromStatus = raw.from_status ?? raw.fromStatus ?? null;
  const toStatus = raw.to_status ?? raw.toStatus ?? null;

  const fromStatusNorm = normalizeStatus(fromStatus);
  const toStatusNorm = normalizeStatus(toStatus);

  const timestampIso = getEventTimestamp(raw);
  const timestamp = toValidDate(timestampIso);

  const ip = getIp(raw) || null;
  const userAgent = getUserAgent(raw) || null;

  const details = getDetails(raw);
  const metadata = isObject(raw.metadata) ? raw.metadata : null;

  // Texto "action" que verá el usuario (más humano)
  const action = getEventTitle(raw);

  return {
    id,
    documentId,
    eventType,
    action, // texto humano
    actionRaw,
    kind,
    actor,
    actorType, // "user" | "system" | "audit"
    fromStatus,
    toStatus,
    fromStatusNorm,
    toStatusNorm,
    ip,
    userAgent,
    createdAt: timestampIso || null,
    timestamp,
    details,
    metadata,
  };
}