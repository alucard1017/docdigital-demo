// backend/validators/createDocumentSchema.js

function validateCreateDocumentBody(body) {
  const errors = [];

  if (!body) {
    errors.push({ field: "body", message: "Body requerido" });
    return errors;
  }

  const title = (body.title || "").toString().trim();
  if (!title || title.length < 2 || title.length > 255) {
    errors.push({
      field: "title",
      message: "El título es obligatorio y debe tener entre 2 y 255 caracteres",
    });
  }

  // En /multi-party esperamos JSON, no multipart.
  // Aquí sí debe venir un array real de signers.
  if (!Array.isArray(body.signers) || body.signers.length === 0) {
    errors.push({
      field: "signers",
      message: "Debes incluir al menos un signer en el cuerpo JSON",
    });
  }

  return errors;
}

module.exports = {
  validateCreateDocumentBody,
};