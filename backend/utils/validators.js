// Valida email básico
function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Valida RUN chileno (simplificado)
function isValidRun(run) {
  if (!run) return false;
  const clean = run.replace(/[^0-9kK]/g, '');
  return clean.length >= 8 && clean.length <= 10;
}

// Valida longitud de strings
function validateLength(str, min, max, fieldName) {
  if (!str) {
    throw new Error(`${fieldName} es obligatorio`);
  }
  if (str.length < min || str.length > max) {
    throw new Error(`${fieldName} debe tener entre ${min} y ${max} caracteres`);
  }
}

module.exports = { isValidEmail, isValidRun, validateLength };
