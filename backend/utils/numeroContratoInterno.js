// utils/numeroContratoInterno.js
function generarNumeroContratoInterno(ultimoNumeroAbsoluto) {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const correlativo = ultimoNumeroAbsoluto + 1;

  const correlativoStr = String(correlativo).padStart(6, '0');

  return `VF-${year}-${correlativoStr}`;
}

module.exports = { generarNumeroContratoInterno };
