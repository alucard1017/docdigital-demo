// backend/controllers/documents/signingEvents.js
// Helpers reutilizables de trazabilidad para acciones del propietario.
// Importar desde signing.js y cualquier otro controller que toque document_events.

const { db } = require("../../db");

/* ================================
   Utilidades de contexto HTTP
   ================================ */

function getClientIp(req) {
  return (
    (req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"]?.toString().split(",").pop().trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null) || null
  );
}

function getUserAgent(req) {
  return req.headers["user-agent"] || null;
}

/* ================================
   Utilidades de documento
   ================================ */

function getDocumentHash(doc) {
  if (!doc) return null;
  return (
    doc.final_hash_sha256 ||
    doc.sealed_hash_sha256 ||
    doc.hash_final_file ||
    doc.pdf_hash_final ||
    doc.hash_sha256 ||
    doc.hash_original_file ||
    null
  );
}

/* ================================
   Builders de metadata
   ================================ */

function buildOwnerMetadata({
  doc,
  req,
  fromStatus,
  toStatus,
  eventType,
  extra = {},
}) {
  return {
    source: "owner_panel",
    actor_type: "OWNER",
    owner_id: req?.user?.id || null,
    owner_name: req?.user?.name || null,
    document_title: doc.title || null,
    document_id: doc.id,
    company_id: doc.company_id || null,
    from_status: fromStatus,
    to_status: toStatus,
    event_type: eventType,
    ...extra,
  };
}

/* ================================
   Helper principal: insertar evento en document_events
   Usar para TODAS las acciones del propietario:
   firma, visado, rechazo y cualquier futura acción.
   ================================ */

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
        $1, NULL, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      )
    `,
    [
      doc.id,
      req.user.name || "Propietario",
      action,
      details,
      fromStatus,
      toStatus,
      eventType,
      ipAddress,
      userAgent,
      hashDocument,
      doc.company_id || null,
      req.user.id || null,
      JSON.stringify(metadata),
    ]
  );
}

module.exports = {
  getClientIp,
  getUserAgent,
  getDocumentHash,
  buildOwnerMetadata,
  insertOwnerEvent,
};