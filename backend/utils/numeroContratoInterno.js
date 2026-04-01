// utils/numeroContratoInterno.js

async function generarNumeroContratoInterno(client, companyId) {
  if (!client || typeof client.query !== "function") {
    throw new Error(
      "generarNumeroContratoInterno requiere un client de PostgreSQL válido"
    );
  }

  if (!companyId) {
    throw new Error("generarNumeroContratoInterno requiere companyId válido");
  }

  const year = new Date().getFullYear();
  const prefix = `VF-${year}-`;

  const { rows } = await client.query(
    `
    SELECT numero_contrato_interno
    FROM documentos
    WHERE (empresa_id = $1 OR company_id = $1)
      AND numero_contrato_interno IS NOT NULL
      AND numero_contrato_interno LIKE $2
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, `${prefix}%`]
  );

  let ultimoCorrelativo = 0;

  if (rows.length > 0) {
    const ultimoNumero = String(rows[0].numero_contrato_interno || "").trim();
    const match = ultimoNumero.match(/(\d+)$/);

    if (match) {
      ultimoCorrelativo = Number(match[1]) || 0;
    }
  }

  const nuevoCorrelativo = ultimoCorrelativo + 1;
  const correlativoStr = String(nuevoCorrelativo).padStart(6, "0");

  return `${prefix}${correlativoStr}`;
}

module.exports = { generarNumeroContratoInterno };