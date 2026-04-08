// backend/controllers/documents/publicDocumentsValidations.js

const { isExpired } = require("./documentEventUtils");

function validatePublicToken(token) {
  if (!token || typeof token !== "string") {
    return { status: 400, body: { message: "Token inválido" } };
  }
  return null;
}

function validatePublicRejectReason(motivo) {
  if (!motivo || !motivo.trim()) {
    return {
      status: 400,
      body: { message: "Debes indicar un motivo de rechazo." },
    };
  }
  return null;
}

function validatePublicAccess(row, expiredMessage) {
  if (isExpired(row.signature_token_expires_at)) {
    return {
      status: 410,
      body: { message: expiredMessage },
    };
  }
  return null;
}

function validatePublicSign(row) {
  const expired = validatePublicAccess(
    row,
    "El enlace de firma ha expirado"
  );
  if (expired) return expired;

  if (row.status === "RECHAZADO") {
    return {
      status: 400,
      body: { message: "Documento rechazado, no se puede firmar" },
    };
  }

  if (row.requires_visado === true && row.status === "PENDIENTE_VISADO") {
    return {
      status: 400,
      body: { message: "Este documento requiere visación antes de firmar" },
    };
  }

  if (row.signer_status === "FIRMADO") {
    return {
      status: 400,
      body: { message: "Este firmante ya firmó el documento" },
    };
  }

  return null;
}

function validatePublicReject(row) {
  const expired = validatePublicAccess(
    row,
    "El enlace de firma ha expirado"
  );
  if (expired) return expired;

  if (row.status === "FIRMADO") {
    return {
      status: 400,
      body: { message: "Documento ya firmado, no se puede rechazar" },
    };
  }

  if (row.status === "RECHAZADO") {
    return {
      status: 400,
      body: { message: "Documento ya fue rechazado anteriormente" },
    };
  }

  if (row.signer_status === "FIRMADO") {
    return {
      status: 400,
      body: {
        message:
          "Este firmante ya firmó el documento, no puede rechazarlo ahora",
      },
    };
  }

  if (row.signer_status === "RECHAZADO") {
    return {
      status: 400,
      body: { message: "Este firmante ya rechazó el documento" },
    };
  }

  return null;
}

function validatePublicVisar(docActual) {
  const expired = validatePublicAccess(
    docActual,
    "El enlace de visado ha expirado"
  );
  if (expired) return expired;

  if (docActual.status === "RECHAZADO") {
    return {
      status: 400,
      body: { message: "Documento rechazado, no se puede visar" },
    };
  }

  if (docActual.requires_visado !== true) {
    return {
      status: 400,
      body: { message: "Este documento no requiere visación" },
    };
  }

  if (docActual.status !== "PENDIENTE_VISADO") {
    return {
      status: 400,
      body: {
        message: "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
      },
    };
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
};