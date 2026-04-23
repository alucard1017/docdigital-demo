// backend/controllers/documents/publicDocumentPayloads.js
const { isTruthyVisado } = require("./publicDocumentsValidations");

function buildPublicDocumentPayload(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    destinatario_nombre: row.destinatario_nombre,
    empresa_rut: row.empresa_rut,
    requires_visado: isTruthyVisado(row.requires_visado),
    signature_status: row.signature_status,
    firmante_nombre: row.firmante_nombre,
    firmante_run: row.firmante_run,
    numero_contrato_interno: row.numero_contrato_interno,
    numero_contrato: row.numero_contrato || row.numero_contrato_interno || "",
    visador_nombre: row.visador_nombre || null,
    pdf_final_url: row.pdf_final_url || null,
    pdf_original_url: row.pdf_original_url || null,
    // Para público, pdf_preview_url apunta a lo que se verá por defecto
    pdf_preview_url:
      row.preview_file_url ||
      row.pdf_preview_url ||
      row.pdf_original_url ||
      null,
    ...extra,
  };
}

function buildCurrentSignerPayload(row) {
  return {
    id: row.signer_id,
    name: row.signer_name,
    email: row.signer_email,
    status: row.signer_status,
    role: row.signer_role || "FIRMANTE",
  };
}

function mapLegacySignerRow(row) {
  return {
    id: row.id,
    name: row.nombre,
    email: row.email,
    rut: row.rut,
    role: row.rol,
    order: row.orden_firma,
    status: row.estado,
    signed_at: row.fecha_firma,
    tipo_firma: row.tipo_firma,
  };
}

function parseEventMetadata(metadata) {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata;

  try {
    return JSON.parse(metadata);
  } catch {
    return metadata;
  }
}

function mapLegacyEventRow(row) {
  return {
    id: row.id,
    event_type: row.tipo_evento,
    ip: row.ip,
    user_agent: row.user_agent,
    metadata: parseEventMetadata(row.metadata),
    created_at: row.created_at,
    descripcion: row.tipo_evento,
  };
}

module.exports = {
  buildPublicDocumentPayload,
  buildCurrentSignerPayload,
  mapLegacySignerRow,
  mapLegacyEventRow,
  parseEventMetadata,
};