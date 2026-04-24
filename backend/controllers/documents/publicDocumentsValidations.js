// backend/controllers/documents/publicDocumentsValidations.js
const { isExpired } = require("./documentEventUtils");

function normalizeState(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildValidationError(status, message, code = null) {
  return {
    status,
    body: {
      ...(code ? { code } : {}),
      message,
    },
  };
}

function validatePublicToken(token) {
  if (!token || typeof token !== "string" || !token.trim()) {
    return buildValidationError(400, "Token inválido", "INVALID_TOKEN");
  }
  return null;
}

function validatePublicRejectReason(motivo) {
  if (!motivo || !String(motivo).trim()) {
    return buildValidationError(
      400,
      "Debes indicar un motivo de rechazo.",
      "INVALID_REJECT_REASON"
    );
  }
  return null;
}

function validatePublicAccess(row, expiredMessage) {
  if (!row) {
    return buildValidationError(
      404,
      "Enlace inválido o documento no encontrado",
      "NOT_FOUND"
    );
  }

  if (isExpired(row.signature_token_expires_at)) {
    return buildValidationError(410, expiredMessage, "LINK_EXPIRED");
  }

  return null;
}

function isTruthyVisado(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "t", "1", "yes", "si", "sí"].includes(normalized);
}

function getDocumentState(row) {
  return normalizeState(row?.status ?? row?.estado);
}

function getReviewState(row) {
  return normalizeState(
    row?.review_status ??
      row?.reviewStatus ??
      row?.estado_revision ??
      row?.review_state
  );
}

function getSignerState(row) {
  return normalizeState(
    row?.signer_status ?? row?.participant_status ?? row?.estado_firmante
  );
}

function isDocumentRejected(row) {
  return getDocumentState(row) === "RECHAZADO";
}

function isDocumentSigned(row) {
  return getDocumentState(row) === "FIRMADO";
}

function isSignerSigned(row) {
  return getSignerState(row) === "FIRMADO";
}

function isSignerRejected(row) {
  return getSignerState(row) === "RECHAZADO";
}

function validatePublicSign(row) {
  const accessError = validatePublicAccess(
    row,
    "El enlace de firma ha expirado."
  );
  if (accessError) return accessError;

  const documentState = getDocumentState(row);

  if (isDocumentRejected(row)) {
    return buildValidationError(
      400,
      "Documento rechazado, no se puede firmar.",
      "DOCUMENT_REJECTED"
    );
  }

  if (isDocumentSigned(row)) {
    return buildValidationError(
      400,
      "Documento ya firmado, no se puede volver a firmar.",
      "DOCUMENT_ALREADY_SIGNED"
    );
  }

  if (
    isTruthyVisado(row.requires_visado) &&
    documentState === "PENDIENTE_VISADO"
  ) {
    return buildValidationError(
      400,
      "Este documento requiere visación antes de firmar.",
      "VISADO_REQUIRED"
    );
  }

  if (isSignerSigned(row)) {
    return buildValidationError(
      400,
      "Este firmante ya firmó el documento.",
      "SIGNER_ALREADY_SIGNED"
    );
  }

  if (isSignerRejected(row)) {
    return buildValidationError(
      400,
      "Este firmante ya rechazó el documento.",
      "SIGNER_ALREADY_REJECTED"
    );
  }

  return null;
}

function validatePublicReject(row) {
  const accessError = validatePublicAccess(
    row,
    "El enlace de firma ha expirado."
  );
  if (accessError) return accessError;

  if (isDocumentSigned(row)) {
    return buildValidationError(
      400,
      "Documento ya firmado, no se puede rechazar.",
      "DOCUMENT_ALREADY_SIGNED"
    );
  }

  if (isDocumentRejected(row)) {
    return buildValidationError(
      400,
      "Documento ya fue rechazado anteriormente.",
      "DOCUMENT_ALREADY_REJECTED"
    );
  }

  if (isSignerSigned(row)) {
    return buildValidationError(
      400,
      "Este firmante ya firmó el documento, no puede rechazarlo ahora.",
      "SIGNER_ALREADY_SIGNED"
    );
  }

  if (isSignerRejected(row)) {
    return buildValidationError(
      400,
      "Este firmante ya rechazó el documento.",
      "SIGNER_ALREADY_REJECTED"
    );
  }

  return null;
}

function validatePublicVisar(row) {
  const accessError = validatePublicAccess(
    row,
    "El enlace de visado ha expirado."
  );
  if (accessError) return accessError;

  const documentState = getDocumentState(row);
  const reviewState = getReviewState(row);

  if (isDocumentRejected(row)) {
    return buildValidationError(
      400,
      "Documento rechazado, no se puede visar.",
      "DOCUMENT_REJECTED"
    );
  }

  if (isDocumentSigned(row)) {
    return buildValidationError(
      400,
      "Documento ya firmado, no requiere visado.",
      "DOCUMENT_ALREADY_SIGNED"
    );
  }

  if (!isTruthyVisado(row.requires_visado)) {
    return buildValidationError(
      400,
      "Este documento no requiere visación.",
      "VISADO_NOT_REQUIRED"
    );
  }

  const isPendingVisado =
    reviewState === "PENDIENTE_VISADO" ||
    documentState === "PENDIENTE_VISADO";

  if (!isPendingVisado) {
    return buildValidationError(
      400,
      "Solo se pueden visar documentos en estado PENDIENTE_VISADO.",
      "INVALID_VISADO_STATE"
    );
  }

  return null;
}

module.exports = {
  validatePublicToken,
  validatePublicRejectReason,
  validatePublicAccess,
  validatePublicSign,
  validatePublicReject,
  validatePublicVisar,
  isTruthyVisado,
};