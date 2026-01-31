// Valida email básico
function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Valida RUN chileno (simplificado)
function isValidRun(run) {
  if (!run || typeof run !== 'string') return false;

  // Eliminamos puntos, guiones y espacios
  const clean = run.replace(/[^0-9kK]/g, '');

  // Debe tener entre 8 y 9 caracteres (7-8 números + dígito verificador)
  if (clean.length < 8 || clean.length > 9) {
    return false;
  }

  // Opcional: validación básica del dígito verificador (si quieres dejarlo solo de longitud, borra todo lo de abajo y deja solo el return true;)
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toLowerCase();

  let sum = 0;
  let multiplier = 2;

  // Cálculo del dígito verificador oficial del RUN/RUT chileno [web:2][web:3]
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rest = 11 - (sum % 11);
  let dvCalc;
  if (rest === 11) dvCalc = '0';
  else if (rest === 10) dvCalc = 'k';
  else dvCalc = String(rest);

  return dv === dvCalc;
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
