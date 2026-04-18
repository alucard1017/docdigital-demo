const { DOCUMENT_STATES } = require("./common");
const { isTruthyVisado } = require("./publicDocumentsValidations");

function checkNotTerminal(doc) {
  if (doc.status === DOCUMENT_STATES.SIGNED) {
    return {
      status: 400,
      body: { message: "El documento ya está firmado" },
    };
  }

  if (doc.status === DOCUMENT_STATES.REJECTED) {
    return {
      status: 400,
      body: { message: "Documento rechazado" },
    };
  }

  return null;
}

function validateSign(doc) {
  const terminal = checkNotTerminal(doc);
  if (terminal) return terminal;

  const requiresVisado = isTruthyVisado(doc?.requires_visado);

  if (requiresVisado && doc.status === "PENDIENTE_VISADO") {
    return {
      status: 400,
      body: { message: "Este documento requiere visación antes de firmar" },
    };
  }

  return null;
}

function validateVisar(doc) {
  const terminal = checkNotTerminal(doc);
  if (terminal) return terminal;

  const requiresVisado = isTruthyVisado(doc?.requires_visado);

  if (!requiresVisado) {
    return {
      status: 400,
      body: { message: "Este documento no requiere visación" },
    };
  }

  if (doc.status !== "PENDIENTE_VISADO") {
    return {
      status: 400,
      body: {
        message: "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
      },
    };
  }

  return null;
}

function validateReject(doc) {
  if (doc.status === DOCUMENT_STATES.SIGNED) {
    return {
      status: 400,
      body: { message: "Ya firmado, no se puede rechazar" },
    };
  }

  if (doc.status === DOCUMENT_STATES.REJECTED) {
    return {
      status: 400,
      body: { message: "Ya rechazado" },
    };
  }

  return null;
}

module.exports = {
  validateSign,
  validateVisar,
  validateReject,
};