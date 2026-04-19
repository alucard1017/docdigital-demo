const { insertDocumentEvent } = require("./documentEventInserts");
const { getClientIp, getUserAgent } = require("./documentEventUtils");

/**
 * Inserta un evento en document_events asociado al flujo interno
 * (acciones de firmantes/visadores internos, cambios de estado, etc.).
 *
 * Contrato de entrada mínimo:
 * - req: Express request (para IP/UA)
 * - doc: { id, company_id?, hash_document? }
 * - actor: string legible (nombre, email o "system")
 * - fromStatus / toStatus: estados antes/después (pueden ser null)
 * - eventType: tipo de evento (ej: "SIGNED_INTERNAL", "VISADO_INTERNAL")
 * - action: acción legible (ej: "DOCUMENT_SIGNED_INTERNAL")
 */
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
  if (!doc || !doc.id) {
    console.warn(
      "[insertFlowActorEvent] llamado sin doc.id. Se omite inserción de evento."
    );
    return;
  }

  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  const finalEventType = eventType || "INTERNAL_FLOW_EVENT";
  const finalAction = action || finalEventType;

  await insertDocumentEvent({
    documentId: doc.id,
    participantId,
    actor: actor || "internal_flow_actor",
    action: finalAction,
    details: details || null,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    eventType: finalEventType,
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

/**
 * Inserta un evento de cambio de estado si realmente hubo cambio
 * (fromStatus !== toStatus).
 *
 * Se apoya en insertFlowActorEvent con eventType fijo "STATUS_CHANGED".
 */
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
  if (!doc || !doc.id) {
    console.warn(
      "[insertFlowStatusChangedEvent] llamado sin doc.id. Se omite inserción."
    );
    return;
  }

  if (!fromStatus && !toStatus) {
    // No hay información útil de transición, evitar ruido en el log
    return;
  }

  if (fromStatus === toStatus) {
    // No hubo cambio efectivo de estado, evitar evento redundante
    return;
  }

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