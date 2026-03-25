// src/validators/createDocumentSchema.js
function validateCreateDocumentBody(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    errors.push("Body inválido");
    return errors;
  }

  if (!body.title || typeof body.title !== "string") {
    errors.push("title es requerido");
  }
  if (!body.fileUrl || typeof body.fileUrl !== "string") {
    errors.push("fileUrl es requerido");
  }

  const allowedFlowTypes = ["simple_signature", "signature_with_review", "with_notary"];
  if (body.flowType && !allowedFlowTypes.includes(body.flowType)) {
    errors.push("flowType inválido");
  }

  const allowedCategories = ["simple", "avanzada"];
  if (body.category && !allowedCategories.includes(body.category)) {
    errors.push("category inválida");
  }

  if (!Array.isArray(body.signers) || body.signers.length === 0) {
    errors.push("Debe haber al menos un signer");
  } else {
    body.signers.forEach((s, idx) => {
      if (!s.role) errors.push(`signers[${idx}].role es requerido`);
      if (!s.fullName) errors.push(`signers[${idx}].fullName es requerido`);
      if (!s.email) errors.push(`signers[${idx}].email es requerido`);
    });
  }

  return errors;
}

module.exports = { validateCreateDocumentBody };