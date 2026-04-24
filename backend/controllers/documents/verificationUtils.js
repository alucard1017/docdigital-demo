// backend/controllers/documents/verificationUtils.js
const db = require("../../db");

async function resolveVerificationData(doc) {
  let codigoVerificacion = null;
  let categoriaFirma = "SIMPLE";

  if (doc.nuevo_documento_id) {
    const docNuevoRes = await db.query(
      `
      SELECT id, codigo_verificacion, categoria_firma
      FROM documentos
      WHERE id = $1
      `,
      [doc.nuevo_documento_id]
    );

    if (docNuevoRes.rowCount > 0) {
      const docNuevo = docNuevoRes.rows[0];
      codigoVerificacion = docNuevo.codigo_verificacion || null;
      categoriaFirma = docNuevo.categoria_firma || "SIMPLE";
    }
  }

  if (!codigoVerificacion) {
    const meta = doc.metadata || {};
    codigoVerificacion =
      meta.codigo_verificacion ||
      meta.verification_code ||
      doc.signature_token ||
      `DOC-${doc.id}`;
  }

  return {
    codigoVerificacion,
    categoriaFirma,
  };
}

module.exports = {
  resolveVerificationData,
};