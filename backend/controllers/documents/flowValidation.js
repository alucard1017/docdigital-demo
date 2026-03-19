// backend/controllers/documents/flowValidation.js

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function validateCreateFlowBody(body) {
  const errors = [];
  const raw = body || {};

  const tipo = normalizeString(raw.tipo);
  const titulo = normalizeString(raw.titulo);
  const categoriaFirma = normalizeString(raw.categoriaFirma);
  const firmantes = raw.firmantes;

  if (!tipo) errors.push("El campo 'tipo' es obligatorio.");
  if (!titulo) errors.push("El campo 'titulo' es obligatorio.");
  if (!categoriaFirma)
    errors.push("El campo 'categoriaFirma' es obligatorio.");

  if (!Array.isArray(firmantes)) {
    errors.push("El campo 'firmantes' debe ser un array.");
  } else if (firmantes.length === 0) {
    errors.push("Debes agregar al menos un firmante.");
  } else {
    firmantes.forEach((f, index) => {
      if (!f || typeof f !== "object") {
        errors.push(`Firmante #${index + 1} es inválido.`);
        return;
      }

      const nombre = normalizeString(f.nombre);
      const email = normalizeString(f.email);

      if (!nombre) {
        errors.push(`Firmante #${index + 1}: 'nombre' es obligatorio.`);
      }
      if (!email) {
        errors.push(`Firmante #${index + 1}: 'email' es obligatorio.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateSendFlowParams(params) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      valid: false,
      error: "ID de documento inválido.",
    };
  }
  return { valid: true, id };
}

module.exports = {
  validateCreateFlowBody,
  validateSendFlowParams,
};
