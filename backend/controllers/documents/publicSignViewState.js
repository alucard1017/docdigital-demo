// backend/controllers/documents/publicSignViewState.js

const NOT_FOUND_MESSAGE = "Enlace inválido o documento no encontrado";
const EXPIRED_LINK_MESSAGE =
  "El enlace público ha expirado. Solicita uno nuevo al emisor.";

/**
 * Construye el estado de vista para enlaces inválidos / expirados / no encontrados.
 * reason: "invalid" | "expired" | "not_found"
 */
function buildInvalidTokenViewState(reason = "invalid") {
  if (reason === "expired") {
    return {
      kind: "expired",
      title: "Este enlace ya expiró",
      message:
        "Este enlace de firma ya no está disponible. Pide al remitente que te envíe un nuevo enlace para continuar.",
    };
  }

  if (reason === "not_found") {
    return {
      kind: "invalid",
      title: "Enlace no disponible",
      message:
        "No encontramos un documento asociado a este enlace. Verifica que el link sea correcto o solicita uno nuevo.",
    };
  }

  return {
    kind: "invalid",
    title: "Este enlace no es válido",
    message:
      "El enlace que abriste no es válido o está incompleto. Verifica que lo hayas copiado completo o solicita uno nuevo.",
  };
}

/**
 * Estado "ready" para cuando el enlace está disponible y se puede actuar.
 */
function buildReadyViewState({ isVisado, signerRoleLabel } = {}) {
  if (isVisado) {
    return {
      kind: "ready",
      title: "Revisa el documento antes de registrar tu visado",
      message:
        "Lee el documento, confirma que la información es correcta y luego registra tu visado para permitir que el flujo continúe.",
    };
  }

  if (signerRoleLabel === "Firmante final") {
    return {
      kind: "ready",
      title: "Revisa el documento antes de firmar",
      message:
        "Lee el documento con calma, verifica los datos y luego confirma tu firma.",
    };
  }

  return {
    kind: "ready",
    title: "Revisa el documento antes de continuar",
    message:
      "Lee el documento con calma, verifica los datos y luego confirma la acción que te corresponde.",
  };
}

/**
 * Estado terminal cuando una acción se completó (firma / visado).
 */
function buildCompletedViewState({ isVisado } = {}) {
  return {
    kind: "completed",
    title: isVisado
      ? "Visado registrado correctamente"
      : "Acción registrada correctamente",
    message: isVisado
      ? "Tu visado ya fue registrado correctamente. No es necesario que realices más acciones desde este enlace."
      : "Tu acción ya fue registrada sobre este documento. No necesitas completar nada más desde este enlace.",
  };
}

/**
 * Estado terminal cuando el documento ha sido rechazado.
 */
function buildRejectedViewState() {
  return {
    kind: "rejected",
    title: "El documento fue rechazado",
    message:
      "Este documento fue rechazado por uno de los participantes. El flujo de firma quedó cerrado desde este enlace.",
  };
}

/**
 * Estado cuando el documento está bloqueado por revisión del emisor.
 */
function buildBlockedByReviewViewState() {
  return {
    kind: "blocked_by_review",
    title: "El documento está en revisión",
    message:
      "El emisor está revisando el documento. Por ahora no se pueden registrar nuevas acciones desde este enlace.",
  };
}

/**
 * Estado de error genérico (problemas de carga, errores inesperados).
 */
function buildErrorViewState(customMessage) {
  return {
    kind: "error",
    title: "Portal de firma pública",
    message:
      customMessage ||
      "Tuvimos un problema al cargar el documento. Intenta nuevamente más tarde o contacta al remitente si el problema continúa.",
  };
}

module.exports = {
  NOT_FOUND_MESSAGE,
  EXPIRED_LINK_MESSAGE,
  buildInvalidTokenViewState,
  buildReadyViewState,
  buildCompletedViewState,
  buildRejectedViewState,
  buildBlockedByReviewViewState,
  buildErrorViewState,
};