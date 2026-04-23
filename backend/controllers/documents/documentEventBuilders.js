// backend/controllers/documents/documentEventBuilders.js

function buildOwnerMetadata({
  doc,
  req,
  fromStatus,
  toStatus,
  eventType,
  extra = {},
}) {
  return {
    // Origen y tipo de actor
    source: "owner_panel",
    actor_type: "OWNER",

    // Identidad del usuario interno
    owner_id: req?.user?.id || null,
    owner_name: req?.user?.name || null,

    // Contexto del documento
    document_id: doc?.id || null,
    document_title: doc?.title || null,
    company_id: doc?.company_id || null,
    numero_contrato_interno: doc?.numero_contrato_interno || null,

    // Transición de estado
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    event_type: eventType || null,

    // Metadata adicional específica del evento
    ...extra,
  };
}

function buildPublicMetadataBase({ doc, extra = {} }) {
  return {
    // Origen general para enlaces públicos
    source: "public_link",

    // Contexto del documento
    document_id: doc?.id || null,
    company_id: doc?.company_id || null,
    numero_contrato_interno: doc?.numero_contrato_interno || null,

    // Metadata específica del evento público (actor_type, link_type, etc.)
    ...extra,
  };
}

module.exports = {
  buildOwnerMetadata,
  buildPublicMetadataBase,
};