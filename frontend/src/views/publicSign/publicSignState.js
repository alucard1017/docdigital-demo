// Normalización de URLs y API base

export function stripTrailingSlashes(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

export function normalizePublicApiBase(API_URL) {
  const raw = API_URL || import.meta.env.VITE_API_URL || "";
  const trimmed = stripTrailingSlashes(raw);
  if (!trimmed) return "";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

// Normalización de texto/estado

export function normalizeStatus(value = "") {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeText(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

export function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

// Sanitización de mensajes de error para UI pública

export function sanitizePublicMessage(message, fallback) {
  const raw = String(message ?? "").trim();
  if (!raw) return fallback;

  const lowered = raw.toLowerCase();

  if (
    lowered.includes("jwt") ||
    lowered.includes("stack") ||
    lowered.includes("sql") ||
    lowered.includes("sequelize") ||
    lowered.includes("postgres") ||
    lowered.includes("token malformed") ||
    lowered.includes("internal server error")
  ) {
    return fallback;
  }

  return raw;
}

// Fetch seguro con JSON y mensaje de error amigable

export async function fetchJsonSafe(url, options = {}) {
  const res = await fetch(url, options);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `La solicitud falló con estado ${res.status}`;
    throw new Error(message);
  }

  return data;
}

// Clasificación de errores de carga inicial del enlace público

export function classifyPublicError(error) {
  const text = String(error ?? "").toLowerCase().trim();

  if (!text) {
    return {
      kind: "error",
      title: "No se pudo abrir el documento",
      message:
        "Ocurrió un problema al cargar este enlace. Intenta nuevamente en unos segundos.",
      canRetry: true,
    };
  }

  if (text.includes("expir") || text.includes("expired")) {
    return {
      kind: "expired",
      title: "Este enlace venció",
      message:
        "Este enlace ya no está disponible. Solicita un nuevo enlace a la empresa que te envió el documento.",
      canRetry: false,
    };
  }

  if (
    text.includes("used") ||
    text.includes("already used") ||
    text.includes("ya fue usado") ||
    text.includes("ya fue firmado") ||
    text.includes("ya fue rechazado") ||
    text.includes("ya no requiere acción") ||
    text.includes("ya no admite acciones")
  ) {
    return {
      kind: "used",
      title: "Este enlace ya no requiere acción",
      message:
        "Este enlace ya fue utilizado anteriormente y no admite una nueva acción.",
      canRetry: false,
    };
  }

  if (
    text.includes("token") ||
    text.includes("inválido") ||
    text.includes("invalido") ||
    text.includes("invalid") ||
    text.includes("no encontrado")
  ) {
    return {
      kind: "invalid",
      title: "Este enlace no es válido",
      message:
        "No pudimos validar este acceso. Abre el enlace completo desde tu correo o solicita uno nuevo.",
      canRetry: false,
    };
  }

  return {
    kind: "error",
    title: "No se pudo abrir el documento",
    message:
      "Ocurrió un problema al cargar este enlace. Intenta nuevamente en unos segundos.",
    canRetry: true,
  };
}

// Roles legibles para la UI pública

export function resolveSignerRoleLabel(signer, isVisado) {
  const rawRole = normalizeText(
    signer?.role ??
      signer?.rol ??
      signer?.signer_role ??
      signer?.participant_role
  );

  if (!rawRole) {
    return isVisado ? "Visador" : "Firmante";
  }

  if (rawRole.includes("vis")) return "Visador";
  if (rawRole.includes("firmante_final")) return "Firmante final";
  if (rawRole.includes("final")) return "Firmante final";
  if (rawRole.includes("firm")) return "Firmante";
  if (rawRole.includes("revi")) return "Revisor";
  if (rawRole.includes("owner") || rawRole.includes("prop")) {
    return "Propietario";
  }

  return isVisado ? "Visador" : "Firmante";
}

export function buildMetaTitle(label, value, extra = "") {
  const main = String(value ?? "").trim();
  const secondary = String(extra ?? "").trim();

  if (main && secondary) return `${label}: ${main} · ${secondary}`;
  if (main) return `${label}: ${main}`;
  return label;
}

export function getReadableParticipantLabel({ signer, isVisado, document }) {
  const roleLabel = resolveSignerRoleLabel(signer, isVisado);

  const signerName = pickFirstNonEmpty(
    signer?.name,
    signer?.nombre,
    signer?.signer_name,
    signer?.full_name,
    signer?.fullname
  );

  const signerEmail = pickFirstNonEmpty(
    signer?.email,
    signer?.signer_email,
    signer?.correo,
    signer?.mail
  );

  if (signerName && signerEmail) {
    return {
      title: isVisado ? "Revisando como" : "Firmando como",
      primary: signerName,
      secondary: `${roleLabel} · ${signerEmail}`,
    };
  }

  if (signerName) {
    return {
      title: isVisado ? "Revisando como" : "Firmando como",
      primary: signerName,
      secondary: roleLabel,
    };
  }

  const fallbackName = isVisado
    ? pickFirstNonEmpty(document?.visador_nombre, "Visador")
    : pickFirstNonEmpty(document?.firmante_nombre, "Firmante");

  return {
    title: isVisado ? "Revisando como" : "Firmando como",
    primary: fallbackName,
    secondary: roleLabel,
  };
}

// Endpoints de acciones públicas

export function buildActionEndpoint({ apiBase, token, isVisado }) {
  const encoded = encodeURIComponent(token);

  return isVisado
    ? `${apiBase}/public/docs/document/${encoded}/visar`
    : `${apiBase}/public/docs/${encoded}/firmar`;
}

export function buildRejectEndpoint({ apiBase, token, tokenKind }) {
  const encoded = encodeURIComponent(token);

  if (tokenKind !== "signer") {
    throw new Error(
      "El rechazo público solo está disponible para enlaces de firmante."
    );
  }

  return `${apiBase}/public/docs/${encoded}/rechazar`;
}

// Mensajes para acciones (firma / visado / rechazo)

export function buildActionSuccessMessage(isVisado, responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    isVisado
      ? "Visado registrado correctamente."
      : "Firma registrada correctamente."
  );
}

export function buildActionErrorMessage(isVisado, responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    isVisado
      ? "No se pudo registrar el visado. Intenta nuevamente."
      : "No se pudo registrar la firma. Intenta nuevamente."
  );
}

export function buildRejectErrorMessage(responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    "No se pudo registrar el rechazo. Intenta nuevamente."
  );
}

// Resolución de viewState de la vista pública

export function resolveViewState({
  hasToken,
  publicSignLoading,
  publicSignError,
  document,
  documentStatus,
  signerStatus,
  isVisado,
  requiresVisado,
}) {
  if (!hasToken) {
    return {
      kind: "invalid",
      title: "Este enlace no es válido",
      message:
        "No pudimos validar este acceso. Abre el enlace completo desde tu correo o solicita uno nuevo.",
      canRetry: false,
    };
  }

  if (publicSignLoading) {
    return {
      kind: "loading",
      title: "Preparando documento",
      message: "Estamos validando el enlace y cargando la información.",
      canRetry: false,
    };
  }

  if (publicSignError) {
    return classifyPublicError(publicSignError);
  }

  if (!document) {
    return {
      kind: "error",
      title: "No se pudo cargar el documento",
      message:
        "El enlace fue reconocido, pero no se encontró la información necesaria para mostrar el documento.",
      canRetry: true,
    };
  }

  const normalizedDocumentStatus = normalizeStatus(documentStatus);
  const normalizedSignerStatus = normalizeStatus(signerStatus);

  const documentRejected =
    normalizedDocumentStatus === "RECHAZADO" ||
    normalizedDocumentStatus === "REJECTED";

  const documentCompleted =
    !isVisado &&
    ["FIRMADO", "SIGNED", "COMPLETED", "COMPLETADO"].includes(
      normalizedDocumentStatus
    );

  const signerAlreadyDone =
    !isVisado &&
    ["FIRMADO", "SIGNED", "COMPLETED", "COMPLETADO"].includes(
      normalizedSignerStatus
    );

  const visadoAlreadyDone =
    isVisado &&
    ["VISADO", "APPROVED", "COMPLETADO", "COMPLETED"].includes(
      normalizedDocumentStatus
    );

  const waitingForReview =
    !isVisado &&
    requiresVisado &&
    ["PENDIENTE_VISADO", "PENDING_REVIEW", "PENDIENTE_REVISION"].includes(
      normalizedDocumentStatus
    );

  if (documentRejected) {
    return {
      kind: "rejected",
      title: "Este documento fue rechazado",
      message: "El flujo quedó cerrado y este enlace ya no admite acciones.",
      canRetry: false,
    };
  }

  if (documentCompleted) {
    return {
      kind: "completed",
      title: "Este documento ya fue firmado",
      message:
        "El proceso ya fue completado y no puedes realizar nuevas acciones desde este enlace.",
      canRetry: false,
    };
  }

  if (signerAlreadyDone) {
    return {
      kind: "used",
      title: "Tu firma ya fue registrada",
      message:
        "Este enlace ya fue usado anteriormente y no requiere una nueva acción.",
      canRetry: false,
    };
  }

  if (visadoAlreadyDone) {
    return {
      kind: "used",
      title: "El visado ya fue registrado",
      message:
        "La revisión del documento ya fue procesada y este enlace no requiere otra acción.",
      canRetry: false,
    };
  }

  if (waitingForReview) {
    return {
      kind: "blocked_by_review",
      title: "Este documento requiere visación antes de firmar",
      message:
        "Aún no puedes firmar porque el documento debe ser visado previamente. Intenta nuevamente cuando la revisión haya sido completada.",
      canRetry: true,
    };
  }

  return {
    kind: "ready",
    title: isVisado ? "Pendiente de visado" : "Pendiente de firma",
    message: isVisado
      ? "Revisa el documento y registra tu visado cuando estés listo."
      : "Revisa el documento y registra tu firma cuando estés listo.",
    canRetry: false,
  };
}

// Badge de estado para el header público

export function getStatusBadge(viewState, isVisado) {
  switch (viewState.kind) {
    case "completed":
      return {
        label: "Completado",
        className: "public-sign-status public-sign-status--success",
      };
    case "used":
      return {
        label: "Sin acción",
        className: "public-sign-status public-sign-status--warning",
      };
    case "rejected":
      return {
        label: "Rechazado",
        className: "public-sign-status public-sign-status--danger",
      };
    case "expired":
      return {
        label: "Enlace vencido",
        className: "public-sign-status public-sign-status--danger",
      };
    case "invalid":
      return {
        label: "Enlace inválido",
        className: "public-sign-status public-sign-status--danger",
      };
    case "error":
      return {
        label: "Error",
        className: "public-sign-status public-sign-status--danger",
      };
    case "loading":
      return {
        label: "Cargando",
        className: "public-sign-status public-sign-status--info",
      };
    case "blocked_by_review":
      return {
        label: "Pendiente de visado",
        className: "public-sign-status public-sign-status--warning",
      };
    case "ready":
    default:
      return {
        label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
        className: isVisado
          ? "public-sign-status public-sign-status--warning"
          : "public-sign-status public-sign-status--info",
      };
  }
}