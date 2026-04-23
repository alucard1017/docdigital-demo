// backend/controllers/documents/publicDocumentQueries.js
const db = require("../../db");

async function resolveParticipantIdForPublicEvent({
  documentId,
  email,
  roleInDoc,
}) {
  if (!documentId || !email) return null;

  try {
    const res = await db.query(
      `
      SELECT id
      FROM document_participants
      WHERE document_id = $1
        AND email = $2
        AND ($3::text IS NULL OR role_in_doc = $3)
      ORDER BY id ASC
      LIMIT 1
      `,
      [documentId, email, roleInDoc || null]
    );

    return res.rows[0]?.id || null;
  } catch (err) {
    console.error(
      "⚠️ Error resolviendo participant_id para evento público:",
      {
        documentId,
        email,
        roleInDoc,
        error: err,
      }
    );
    return null;
  }
}

async function getDocumentAndSignerByDocumentToken(
  documentToken,
  emailFromQuery = null
) {
  const { rows } = await db.query(
    `
    SELECT
      d.*,
      s.id     AS signer_id,
      s.status AS signer_status,
      s.name   AS signer_name,
      s.email  AS signer_email
    FROM documents d
    LEFT JOIN document_signers s
      ON s.document_id = d.id
      AND ($2::text IS NULL OR s.email = $2)
    WHERE d.signature_token = $1
    LIMIT 1
    `,
    [documentToken, emailFromQuery]
  );

  return rows[0] || null;
}

async function getPublicSignerDocumentByToken(token) {
  const { rows } = await db.query(
    `
    SELECT 
      d.*,
      d.destinatario_nombre,
      d.empresa_rut,
      d.requires_visado,
      d.signature_status,
      d.signature_token_expires_at,
      d.firmante_nombre,
      d.firmante_run,
      d.numero_contrato_interno,
      COALESCE(
        d.numero_contrato_interno,
        d.metadata->>'numero_contrato',
        d.metadata->>'numero_interno',
        d.metadata->>'contract_number',
        d.metadata->>'codigo_contrato'
      ) AS numero_contrato,
      s.id     AS signer_id,
      s.name   AS signer_name,
      s.email  AS signer_email,
      s.status AS signer_status,
      s.role   AS signer_role
    FROM document_signers s
    JOIN documents d ON d.id = s.document_id
    WHERE s.sign_token = $1
    `,
    [token]
  );

  return rows[0] || null;
}

async function getPublicDocumentBySignatureToken(token) {
  const { rows } = await db.query(
    `
    SELECT 
      d.*,
      d.destinatario_nombre,
      d.empresa_rut,
      d.requires_visado,
      d.signature_status,
      d.signature_token_expires_at,
      d.firmante_nombre,
      d.firmante_run,
      d.numero_contrato_interno,
      d.visador_nombre,
      COALESCE(
        d.numero_contrato_interno,
        d.metadata->>'numero_contrato',
        d.metadata->>'numero_interno',
        d.metadata->>'contract_number',
        d.metadata->>'codigo_contrato'
      ) AS numero_contrato
    FROM documents d
    WHERE d.signature_token = $1
    `,
    [token]
  );

  return rows[0] || null;
}

async function getPublicSignContextByToken(token) {
  const { rows } = await db.query(
    `
    SELECT 
      s.id     AS signer_id,
      s.status AS signer_status,
      s.name   AS signer_name,
      s.email  AS signer_email,
      s.role   AS signer_role,
      s.must_sign,
      s.must_review,
      d.*,
      COALESCE(
        d.numero_contrato_interno,
        d.metadata->>'numero_contrato',
        d.metadata->>'numero_interno',
        d.metadata->>'contract_number',
        d.metadata->>'codigo_contrato'
      ) AS numero_contrato
    FROM document_signers s
    JOIN documents d ON d.id = s.document_id
    WHERE s.sign_token = $1
    `,
    [token]
  );

  return rows[0] || null;
}

async function getPublicRejectContextByToken(token) {
  const { rows } = await db.query(
    `
    SELECT 
      s.id     AS signer_id,
      s.status AS signer_status,
      s.name   AS signer_name,
      s.email  AS signer_email,
      s.role   AS signer_role,
      d.*,
      COALESCE(
        d.numero_contrato_interno,
        d.metadata->>'numero_contrato',
        d.metadata->>'numero_interno',
        d.metadata->>'contract_number',
        d.metadata->>'codigo_contrato'
      ) AS numero_contrato
    FROM document_signers s
    JOIN documents d ON d.id = s.document_id
    WHERE s.sign_token = $1
    `,
    [token]
  );

  return rows[0] || null;
}

async function getPublicVisadoContextByToken(token) {
  const { rows } = await db.query(
    `
    SELECT 
      d.*,
      COALESCE(
        d.numero_contrato_interno,
        d.metadata->>'numero_contrato',
        d.metadata->>'numero_interno',
        d.metadata->>'contract_number',
        d.metadata->>'codigo_contrato'
      ) AS numero_contrato
    FROM documents d
    WHERE d.signature_token = $1
    `,
    [token]
  );

  return rows[0] || null;
}

async function markSignerAsSigned(signerId) {
  await db.query(
    `
    UPDATE document_signers
    SET status = 'FIRMADO',
        signed_at = NOW()
    WHERE id = $1
    `,
    [signerId]
  );
}

async function markParticipantAsSigned(documentId, email) {
  await db.query(
    `
    UPDATE document_participants
    SET status = 'FIRMADO',
        signed_at = NOW(),
        updated_at = NOW()
    WHERE document_id = $1
      AND email = $2
    `,
    [documentId, email]
  );
}

async function markSignerAsRejected(signerId, motivo) {
  await db.query(
    `
    UPDATE document_signers
    SET status = 'RECHAZADO',
        rejected_at = NOW(),
        rejection_reason = $2
    WHERE id = $1
    `,
    [signerId, motivo]
  );
}

async function markParticipantAsRejected(documentId, email) {
  await db.query(
    `
    UPDATE document_participants
    SET status = 'RECHAZADO',
        updated_at = NOW()
    WHERE document_id = $1
      AND email = $2
    `,
    [documentId, email]
  );
}

async function countSigningProgress(documentId) {
  const { rows } = await db.query(
    `
    SELECT 
      COUNT(*) FILTER (
        WHERE status = 'FIRMADO'
          AND (must_sign = TRUE OR role != 'VISADOR')
      ) AS signed_count,
      COUNT(*) FILTER (
        WHERE (must_sign = TRUE OR role != 'VISADOR')
      ) AS total_signers
    FROM document_signers
    WHERE document_id = $1
    `,
    [documentId]
  );

  return rows[0];
}

async function updateDocumentStatuses(documentId, status, signatureStatus) {
  const { rows } = await db.query(
    `
    UPDATE documents
    SET status = $1,
        signature_status = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
    `,
    [status, signatureStatus, documentId]
  );

  return rows[0] || null;
}

async function rejectDocument(documentId, motivo) {
  const { rows } = await db.query(
    `
    UPDATE documents
    SET status = 'RECHAZADO',
        signature_status = 'RECHAZADO',
        reject_reason = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
    `,
    [documentId, motivo]
  );

  return rows[0] || null;
}

async function updateDocumentToPendingFirma(documentId) {
  const { rows } = await db.query(
    `
    UPDATE documents
    SET status = $1,
        signature_status = COALESCE(signature_status, 'PENDIENTE'),
        updated_at = NOW()
    WHERE id = $2
    RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
    `,
    ["PENDIENTE_FIRMA", documentId]
  );

  return rows[0] || null;
}

async function syncLegacySigned(nuevoDocumentoId, signerEmail, allSigned) {
  await db.query(
    `
    UPDATE documentos
    SET estado = $1,
        updated_at = NOW()
    WHERE id = $2
    `,
    [allSigned ? "FIRMADO" : "PENDIENTE_FIRMA", nuevoDocumentoId]
  );

  await db.query(
    `
    UPDATE firmantes
    SET estado = 'FIRMADO',
        fecha_firma = NOW(),
        tipo_firma = 'SIMPLE',
        updated_at = NOW()
    WHERE documento_id = $1
      AND email = $2
    `,
    [nuevoDocumentoId, signerEmail]
  );
}

async function syncLegacyRejected(nuevoDocumentoId, signerEmail) {
  await db.query(
    `
    UPDATE documentos
    SET estado = 'RECHAZADO',
        updated_at = NOW()
    WHERE id = $1
    `,
    [nuevoDocumentoId]
  );

  await db.query(
    `
    UPDATE firmantes
    SET estado = 'RECHAZADO',
        updated_at = NOW()
    WHERE documento_id = $1
      AND email = $2
    `,
    [nuevoDocumentoId, signerEmail]
  );
}

async function getLegacyDocumentByVerificationCode(codigo) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM documentos
    WHERE codigo_verificacion = $1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function getLegacySigners(documentoId) {
  const { rows } = await db.query(
    `
    SELECT
      id,
      nombre,
      email,
      rut,
      rol,
      orden_firma,
      estado,
      fecha_firma,
      tipo_firma
    FROM firmantes
    WHERE documento_id = $1
    ORDER BY orden_firma ASC
    `,
    [documentoId]
  );

  return rows;
}

async function getLegacySignatureEvents(documentoId) {
  const { rows } = await db.query(
    `
    SELECT
      id,
      tipo_evento,
      ip,
      user_agent,
      metadata,
      created_at
    FROM eventos_firma
    WHERE documento_id = $1
    ORDER BY created_at ASC
    `,
    [documentoId]
  );

  return rows;
}

async function getModernDocumentByLegacyId(nuevoDocumentoId) {
  const { rows } = await db.query(
    `
    SELECT
      id,
      nuevo_documento_id,
      file_path,
      pdf_original_url,
      preview_file_url,
      pdf_final_url,
      final_storage_key,
      final_file_url,
      original_storage_key,
      company_id,
      numero_contrato_interno,
      status,
      hash_final_file,
      pdf_hash_final,
      hash_original_file,
      metadata
    FROM documents
    WHERE nuevo_documento_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [nuevoDocumentoId]
  );

  return rows[0] || null;
}

async function refreshPdfFields(docId, targetDoc) {
  const { rows } = await db.query(
    `
    SELECT
      pdf_final_url,
      final_storage_key,
      final_file_url,
      preview_file_url
    FROM documents
    WHERE id = $1
    `,
    [docId]
  );

  if (!rows.length) return targetDoc;

  const updated = rows[0];

  targetDoc.pdf_final_url =
    updated.pdf_final_url || targetDoc.pdf_final_url || null;
  targetDoc.final_storage_key =
    updated.final_storage_key || targetDoc.final_storage_key || null;
  targetDoc.final_file_url =
    updated.final_file_url || targetDoc.final_file_url || null;
  targetDoc.preview_file_url =
    updated.preview_file_url || targetDoc.preview_file_url || null;

  return targetDoc;
}

module.exports = {
  resolveParticipantIdForPublicEvent,
  getDocumentAndSignerByDocumentToken,
  getPublicSignerDocumentByToken,
  getPublicDocumentBySignatureToken,
  getPublicSignContextByToken,
  getPublicRejectContextByToken,
  getPublicVisadoContextByToken,
  markSignerAsSigned,
  markParticipantAsSigned,
  markSignerAsRejected,
  markParticipantAsRejected,
  countSigningProgress,
  updateDocumentStatuses,
  rejectDocument,
  updateDocumentToPendingFirma,
  syncLegacySigned,
  syncLegacyRejected,
  getLegacyDocumentByVerificationCode,
  getLegacySigners,
  getLegacySignatureEvents,
  getModernDocumentByLegacyId,
  refreshPdfFields,
};