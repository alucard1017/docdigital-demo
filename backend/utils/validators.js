// backend/utils/validators.js

function normalizeString(value) {
  return String(value ?? "").trim();
}

function isValidEmail(email) {
  const value = normalizeString(email);
  if (!value) return false;

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  return regex.test(value);
}

function cleanRun(run) {
  return normalizeString(run).replace(/[^0-9kK]/g, "");
}

function isValidRun(run) {
  const clean = cleanRun(run);
  if (clean.length < 8 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toLowerCase();

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    const digit = Number(body[i]);
    if (Number.isNaN(digit)) return false;

    sum += digit * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rest = 11 - (sum % 11);

  let expectedDv = "";
  if (rest === 11) expectedDv = "0";
  else if (rest === 10) expectedDv = "k";
  else expectedDv = String(rest);

  return dv === expectedDv;
}

function validateLength(value, min = 0, max = Infinity) {
  const normalized = normalizeString(value);
  return normalized.length >= min && normalized.length <= max;
}

function isNonEmptyString(value, min = 1) {
  return validateLength(value, min, Infinity);
}

module.exports = {
  normalizeString,
  cleanRun,
  isValidEmail,
  isValidRun,
  validateLength,
  isNonEmptyString,
};