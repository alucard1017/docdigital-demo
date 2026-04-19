// backend/controllers/documents/documentEventInserts.js
const db = require("../../db");
const {
  getClientIp,
  getUserAgent,
  getDocumentHash,
} = require("./documentEventUtils");
const {
  buildOwnerMetadata,
  buildPublicMetadataBase,
} = require("./documentEventBuilders");

/**
 * Inserta un evento genérico en document_events.
 * - Siempre guarda JSON válido en metadata.
 * - Refuerza un contrato mínimo: ids, estados, tipo de evento, contexto técnico.
 */
async function insertDocumentEvent({
  documentId,
  participantId = null,
  actor,
  action,
  details,
  fromStatus = null,
  toStatus = null,
  eventType,
  ipAddress = null,
  userAgent = null,
  hashDocument = null,
  companyId = null,
  userId = null,
  metadata = {},
}) {
  const baseEventType = eventType || metadata.event_type || action || null;

  const safeMetadata = {
    // Contrato mínimo transversal (útil para auditoría y sellado)
    source: metadata.source || "document_events",
    company_id: companyId ?? metadata.company_id ?? null,
    user_id: userId ?? metadata.user_id ?? null,
    document_id: documentId ?? metadata.document_id ?? null,
    participant_id: participantId ?? metadata.participant_id ?? null,
    from_status: fromStatus ?? metadata.from_status ?? null,
    to_status: toStatus ?? metadata.to_status ?? null,
    event_type: baseEventType,
    action: action || metadata.action || null,
    // Contexto de dispositivo / red (alineado con buenas prácticas de audit trail)
    ip_address: ipAddress ?? metadata.ip_address ?? null,
    user_agent: userAgent ?? metadata.user_agent ?? null,
    hash_document: hashDocument ?? metadata.hash_document ?? null,
    // Resto de metadata extendida, sin perder nada de lo que mandes
    ...metadata,
  };

  await db.query(
    `
    INSERT INTO document_events (
      document_id,
      participant_id,
      actor,
      action,
      details,
      from_status,
      to_status,
      event_type,
      ip_address,
      user_agent,
      hash_document,
      company_id,
      user_id,
      metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14
    )
    `,
    [
      documentId,
      participantId,
      actor,
      action,
      details || null,
      fromStatus,
      toStatus,
      baseEventType,
      ipAddress,
      userAgent,
      hashDocument,
      companyId,
      userId,
      JSON.stringify(safeMetadata),
    ]
  );
}

/**
 * Evento para acciones del propietario (panel interno).
 * Mantiene metadatos ricos e incorpora el contrato mínimo estándar.
 */
async function insertOwnerEvent({
  req,
  doc,
  fromStatus,
  toStatus,
  eventType,
  action,
  details,
  extraMetadata = {},
}) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  const hashDocument = getDocumentHash(doc);

  const ownerMetadata = buildOwnerMetadata({
    doc,
    req,
    fromStatus,
    toStatus,
    eventType,
    extra: extraMetadata,
  });

  await insertDocumentEvent({
    documentId: doc.id,
    participantId: null,
    actor: req?.user?.name || `user:${req?.user?.id || "owner"}`,
    action,
    details,
    fromStatus,
    toStatus,
    eventType,
    ipAddress,
    userAgent,
    hashDocument,
    companyId: doc.company_id || null,
    userId: req?.user?.id || null,
    metadata: {
      ...ownerMetadata,
      source: ownerMetadata.source || "owner_action",
    },
  });
}

/**
 * Evento para acciones vía enlace público (firmante / visador / viewer).
 */
async function insertPublicEvent({
  req,
  doc,
  participantId = null,
  actor = "PUBLIC_USER",
  action,
  details,
  fromStatus = null,
  toStatus = null,
  eventType,
  extraMetadata = {},
}) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  const hashDocument = getDocumentHash(doc);

  const publicMetadata = buildPublicMetadataBase({
    doc,
    extra: extraMetadata,
  });

  await insertDocumentEvent({
    documentId: doc.id,
    participantId,
    actor,
    action,
    details,
    fromStatus,
    toStatus,
    eventType,
    ipAddress,
    userAgent,
    hashDocument,
    companyId: doc.company_id || null,
    userId: null,
    metadata: {
      ...publicMetadata,
      source: publicMetadata.source || "public_link",
    },
  });
}

/**
 * Atajo para registrar STATUS_CHANGED desde contexto público.
 */
async function insertPublicStatusChangedEvent({
  req,
  doc,
  fromStatus,
  toStatus,
  details,
  extraMetadata = {},
}) {
  await insertPublicEvent({
    req,
    doc,
    participantId: null,
    actor: "system",
    action: "STATUS_CHANGED",
    details,
    fromStatus,
    toStatus,
    eventType: "STATUS_CHANGED",
    extraMetadata,
  });
}

module.exports = {
  insertDocumentEvent,
  insertOwnerEvent,
  insertPublicEvent,
  insertPublicStatusChangedEvent,
};