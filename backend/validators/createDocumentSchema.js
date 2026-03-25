// backend/validators/createDocumentSchema.js

function validateCreateDocumentBody(body) {
  const errors = [];

  if (!body) {
    errors.push({ field: "body", message: "Body requerido" });
    return errors;
  }

  if (!body.title || typeof body.title !== "string") {
    errors.push({ field: "title", message: "El título es obligatorio" });
  }

  if (!Array.isArray(body.signers) || body.signers.length === 0) {
    errors.push({
      field: "signers",
      message: "Debes incluir al menos un signer",
    });
  }

  // puedes añadir más validaciones luego

  return errors;
}

module.exports = {
  validateCreateDocumentBody,
};