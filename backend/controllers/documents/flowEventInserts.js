// backend/controllers/documents/flowEventInserts.js

const { insertDocumentEvent } = require("./documentEventInserts");
const { getClientIp, getUserAgent } = require("./documentEventUtils");

async function insertFlowActorEvent({
  req,
  doc,
  actor,
  fromStatus,
  toStatus,
  eventType,
  action,
  details,
  userId = null,
  participantId = null,
  extraMetadata = {},
}) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  await insertDocumentEvent({
    documentId: doc.id,
    participantId,
    actor: actor || "internal_flow_actor",
    action,
    details,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    eventType,
    ipAddress,
    userAgent,
    hashDocument: doc.hash_document || doc.hash_sha256 || null,
    companyId: doc.company_id || null,
    userId,
    metadata: {
      source: "internal_flow",
      ...extraMetadata,
    },
  });
}

async function insertFlowStatusChangedEvent({
  req,
  doc,
  actor = "system",
  fromStatus,
  toStatus,
  details = "Cambio de estado del documento",
  userId = null,
  extraMetadata = {},
}) {
  if (fromStatus === toStatus) return;

  await insertFlowActorEvent({
    req,
    doc,
    actor,
    fromStatus,
    toStatus,
    eventType: "STATUS_CHANGED",
    action: "DOCUMENT_STATUS_CHANGED",
    details,
    userId,
    extraMetadata,
  });
}

module.exports = {
  insertFlowActorEvent,
  insertFlowStatusChangedEvent,
};