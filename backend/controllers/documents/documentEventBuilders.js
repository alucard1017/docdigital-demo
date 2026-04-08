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
    source: "owner_panel",
    actor_type: "OWNER",
    owner_id: req?.user?.id || null,
    owner_name: req?.user?.name || null,
    document_title: doc?.title || null,
    document_id: doc?.id || null,
    company_id: doc?.company_id || null,
    from_status: fromStatus,
    to_status: toStatus,
    event_type: eventType,
    ...extra,
  };
}

function buildPublicMetadataBase({ doc, extra = {} }) {
  return {
    source: "public_link",
    document_id: doc?.id || null,
    company_id: doc?.company_id || null,
    numero_contrato_interno: doc?.numero_contrato_interno || null,
    ...extra,
  };
}

module.exports = {
  buildOwnerMetadata,
  buildPublicMetadataBase,
};