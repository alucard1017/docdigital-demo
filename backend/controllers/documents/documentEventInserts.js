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
      details,
      fromStatus,
      toStatus,
      eventType,
      ipAddress,
      userAgent,
      hashDocument,
      companyId,
      userId,
      // guardamos siempre JSON válido
      JSON.stringify(metadata || {}),
    ]
  );
}

/**
 * Evento para acciones del propietario (panel interno).
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

  const metadata = buildOwnerMetadata({
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
    actor: req?.user?.name || "Propietario",
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
    metadata,
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

  const metadata = buildPublicMetadataBase({
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
    metadata,
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