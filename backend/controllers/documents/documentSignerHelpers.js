const { isValidEmail } = require("./common");
const {
  normalizeArray,
  normalizeBoolean,
  safeLower,
  uniqueBy,
} = require("./documentUtils");

function buildSignerName(signer = {}) {
  return (
    signer.nombreCompleto ||
    signer.nombre ||
    signer.name ||
    [signer.nombres, signer.apellidos].filter(Boolean).join(" ").trim() ||
    "Firmante"
  );
}

function buildSignerEmail(signer = {}) {
  return (
    signer.email ||
    signer.correo ||
    signer.mail ||
    signer.email_address ||
    ""
  )
    .trim()
    .toLowerCase();
}

function buildSignerPhone(signer = {}) {
  return (
    signer.telefono ||
    signer.phone ||
    signer.celular ||
    signer.mobile ||
    null
  );
}

function buildSignerOrder(signer = {}, index = 0) {
  const value =
    signer.orden_firma ??
    signer.orden ??
    signer.order ??
    signer.sign_order ??
    index + 1;

  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : index + 1;
}

function buildSignerType(signer = {}) {
  return (signer.tipo || signer.role || signer.rol || "FIRMANTE")
    .toString()
    .trim()
    .toUpperCase();
}

function buildSignerMustSign(signer = {}) {
  if (signer.debe_firmar !== undefined)
    return normalizeBoolean(signer.debe_firmar, true);
  if (signer.must_sign !== undefined)
    return normalizeBoolean(signer.must_sign, true);
  return true;
}

function buildSignerMustReview(signer = {}) {
  if (signer.debe_visar !== undefined)
    return normalizeBoolean(signer.debe_visar, false);
  if (signer.must_review !== undefined)
    return normalizeBoolean(signer.must_review, false);
  return false;
}

function sanitizeSigners(rawSigners = []) {
  const signers = normalizeArray(rawSigners)
    .map((signer, index) => ({
      ...signer,
      nombre: buildSignerName(signer),
      email: buildSignerEmail(signer),
      telefono: buildSignerPhone(signer),
      orden: buildSignerOrder(signer, index),
      tipo: buildSignerType(signer),
      debe_firmar: buildSignerMustSign(signer),
      debe_visar: buildSignerMustReview(signer),
      mensaje_personalizado:
        signer.mensaje_personalizado || signer.customMessage || null,
    }))
    .filter((s) => s.email && isValidEmail(s.email));

  return uniqueBy(
    signers.sort((a, b) => a.orden - b.orden),
    (s) => `${safeLower(s.email)}|${s.orden}|${s.tipo}`
  );
}

function generarSignToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

module.exports = {
  buildSignerName,
  buildSignerEmail,
  buildSignerPhone,
  buildSignerOrder,
  buildSignerType,
  buildSignerMustSign,
  buildSignerMustReview,
  sanitizeSigners,
  generarSignToken,
};