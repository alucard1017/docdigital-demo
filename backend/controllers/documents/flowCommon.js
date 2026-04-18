// backend/controllers/documents/flowCommon.js

const common = require("./common");
const { crypto, DOCUMENT_STATES } = common;

const pool = common?.db?.pool || common?.db;
if (!pool || typeof pool.query !== "function") {
  throw new Error(
    "No se pudo resolver un cliente/pool SQL válido desde ./common"
  );
}

const getDbClient = async () => {
  if (typeof pool.connect === "function") {
    return pool.connect();
  }

  return {
    query: (...args) => pool.query(...args),
    release: () => {},
  };
};

const rollbackSafely = async (client) => {
  if (!client) return;
  try {
    await client.query("ROLLBACK");
  } catch (e) {
    console.error("❌ Error en rollback:", e.message);
    console.error(e.stack);
  }
};

const upsertDocumentMirror = async (
  client,
  {
    nuevoDocumentoId,
    title,
    status,
    companyId,
    ownerId,
    filePath = null,
    description = null,
    signFlowType = "SEQUENTIAL",
    notaryMode = "NONE",
    countryCode = "CL",
    enviadoEn = null,
    firmadoEn = null,
    fechaExpiracion = null,
    signedFilePath = null,
    legalSummary = null,
    hashOriginalFile = null,
    hashFinalFile = null,
    rutEmisor = null,
  }
) => {
  const query = `
    INSERT INTO documents (
      nuevo_documento_id,
      title,
      description,
      file_path,
      status,
      company_id,
      owner_id,
      sign_flow_type,
      notary_mode,
      country_code,
      enviado_en,
      firmado_en,
      fecha_expiracion,
      signed_file_path,
      legal_summary,
      hash_original_file,
      hash_final_file,
      rut_emisor,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,
      NOW(),NOW()
    )
    ON CONFLICT (nuevo_documento_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      file_path = EXCLUDED.file_path,
      status = EXCLUDED.status,
      company_id = EXCLUDED.company_id,
      owner_id = EXCLUDED.owner_id,
      sign_flow_type = EXCLUDED.sign_flow_type,
      notary_mode = EXCLUDED.notary_mode,
      country_code = EXCLUDED.country_code,
      enviado_en = EXCLUDED.enviado_en,
      firmado_en = EXCLUDED.firmado_en,
      fecha_expiracion = EXCLUDED.fecha_expiracion,
      signed_file_path = EXCLUDED.signed_file_path,
      legal_summary = EXCLUDED.legal_summary,
      hash_original_file = EXCLUDED.hash_original_file,
      hash_final_file = EXCLUDED.hash_final_file,
      rut_emisor = EXCLUDED.rut_emisor,
      updated_at = NOW()
    RETURNING id;
  `;

  const values = [
    nuevoDocumentoId,
    title,
    description,
    filePath,
    status,
    companyId,
    ownerId,
    signFlowType,
    notaryMode,
    countryCode,
    enviadoEn,
    firmadoEn,
    fechaExpiracion,
    signedFilePath,
    legalSummary,
    hashOriginalFile,
    hashFinalFile,
    rutEmisor,
  ];

  const result = await client.query(query, values);
  return result.rows[0].id;
};

const countLegacySignatures = async (client, documentId) => {
  const countRes = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE estado = 'FIRMADO') AS firmados,
      COUNT(*) AS total
    FROM firmantes
    WHERE documento_id = $1
    `,
    [documentId]
  );

  const row = countRes.rows[0] || {};
  return {
    firmadosNum: Number(row.firmados || 0),
    totalNum: Number(row.total || 0),
  };
};

const countParticipantSignatures = async (client, documentId) => {
  if (!documentId) {
    return {
      firmadosDpNum: 0,
      totalDpNum: 0,
    };
  }

  const dpCountRes = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados_dp,
      COUNT(*) AS total_dp
    FROM document_participants
    WHERE document_id = $1
    `,
    [documentId]
  );

  const row = dpCountRes.rows[0] || {};
  return {
    firmadosDpNum: Number(row.firmados_dp || 0),
    totalDpNum: Number(row.total_dp || 0),
  };
};

const getDocumentFlowType = async (client, documentId) => {
  const result = await client.query(
    `
    SELECT tipo_flujo
    FROM documentos
    WHERE id = $1
    `,
    [documentId]
  );

  return result.rows[0]?.tipo_flujo || "SECUENCIAL";
};

const validateSequentialSigning = async (client, { documentId, order }) => {
  const pendingBeforeRes = await client.query(
    `
    SELECT COUNT(*) AS pendientes
    FROM firmantes
    WHERE documento_id = $1
      AND orden_firma < $2
      AND estado <> 'FIRMADO'
    `,
    [documentId, order]
  );

  return Number(pendingBeforeRes.rows[0]?.pendientes || 0);
};

const mapLegacyStatusToDocumentsStatus = (legacyStatus) => {
  switch (legacyStatus) {
    case "BORRADOR":
      return DOCUMENT_STATES.DRAFT;
    case "EN_FIRMA":
      return "PENDIENTE_FIRMA";
    case "FIRMADO":
      return DOCUMENT_STATES.SIGNED;
    case "RECHAZADO":
      return DOCUMENT_STATES.REJECTED;
    default:
      return legacyStatus || DOCUMENT_STATES.DRAFT;
  }
};

const mapFlowStateAfterSend = () => ({
  legacyStatus: "EN_FIRMA",
  documentsStatus: "PENDIENTE_FIRMA",
});

const mapFlowStateAfterSigned = () => ({
  legacyStatus: "FIRMADO",
  documentsStatus: DOCUMENT_STATES.SIGNED,
});

const mapFlowStateWhileSigning = () => ({
  legacyStatus: "EN_FIRMA",
  documentsStatus: "PENDIENTE_FIRMA",
});

const mapFlowStateAfterRejected = () => ({
  legacyStatus: "RECHAZADO",
  documentsStatus: DOCUMENT_STATES.REJECTED,
});

module.exports = {
  crypto,
  DOCUMENT_STATES,
  getDbClient,
  rollbackSafely,
  upsertDocumentMirror,
  countLegacySignatures,
  countParticipantSignatures,
  getDocumentFlowType,
  validateSequentialSigning,
  mapLegacyStatusToDocumentsStatus,
  mapFlowStateAfterSend,
  mapFlowStateAfterSigned,
  mapFlowStateWhileSigning,
  mapFlowStateAfterRejected,
};