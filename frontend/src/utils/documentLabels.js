// frontend/src/utils/documentLabels.js

export function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

export function isTruthyFlag(value) {
  if (value === true || value === 1) return true;

  const v = normalizeLower(value);
  return [
    "true",
    "1",
    "si",
    "sí",
    "yes",
    "y",
    "on",
    "notaria",
    "notaría",
    "con_notaria",
    "con_notaría",
    "con notaria",
    "con notaría",
    "notarial",
    "requiere_notaria",
    "requiere_notaría",
    "requiere visado",
    "con_visado",
    "visado",
  ].includes(v);
}

export function isFalsyFlag(value) {
  if (value === false || value === 0) return true;

  const v = normalizeLower(value);
  return [
    "false",
    "0",
    "no",
    "off",
    "propio",
    "general",
    "sin_notaria",
    "sin_notaría",
    "sin notaria",
    "sin notaría",
    "sin_visado",
  ].includes(v);
}

function getMetaContainer(doc = {}) {
  return doc.metadata || doc.meta || doc.document_metadata || {};
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function getRawDocumentKind(doc = {}) {
  const meta = getMetaContainer(doc);

  return pickFirstNonEmpty(
    doc.document_type,
    doc.tipo_documento,
    doc.tipoDocumento,
    doc.template_type,
    doc.template_name,
    doc.document_kind,
    doc.kind,
    doc.category,
    doc.categoria,
    meta.document_type,
    meta.tipo_documento,
    meta.tipoDocumento,
    meta.template_type,
    meta.template_name,
    meta.document_kind,
    meta.kind,
    meta.category,
    meta.categoria
  );
}

function getRawProcedureType(doc = {}) {
  const meta = getMetaContainer(doc);

  return pickFirstNonEmpty(
    doc.tipo_tramite,
    doc.tramite_tipo,
    doc.tipoTramite,
    doc.tipo,
    doc.procedure_type,
    doc.flow_type,
    doc.categoria_firma,
    meta.tipo_tramite,
    meta.tramite_tipo,
    meta.tipoTramite,
    meta.tipo,
    meta.procedure_type,
    meta.flow_type,
    meta.categoria_firma
  );
}

function getRawNotaryFlag(doc = {}) {
  const meta = getMetaContainer(doc);

  return (
    doc.requires_notary ??
    doc.con_notaria ??
    doc.notarial ??
    doc.es_notarial ??
    doc.requiere_firma_notarial ??
    doc.requiresNotary ??
    meta.requires_notary ??
    meta.con_notaria ??
    meta.notarial ??
    meta.es_notarial ??
    meta.requiere_firma_notarial ??
    meta.requiresNotary
  );
}

function getRawVisadoFlag(doc = {}) {
  const meta = getMetaContainer(doc);

  return (
    doc.requires_visado ??
    doc.requiresVisado ??
    doc.con_visado ??
    doc.visado ??
    doc.tiene_visado ??
    meta.requires_visado ??
    meta.requiresVisado ??
    meta.con_visado ??
    meta.visado ??
    meta.tiene_visado
  );
}

function getRequiresVisado(doc = {}) {
  const meta = getMetaContainer(doc);

  const raw =
    doc.requires_visado ??
    doc.requiresVisado ??
    doc.requiere_visado ??
    doc.tiene_visador ??
    meta.requires_visado ??
    meta.requiresVisado ??
    meta.requiere_visado ??
    meta.tiene_visador;

  if (raw === true || raw === false) return raw;
  if (isTruthyFlag(raw)) return true;
  if (isFalsyFlag(raw)) return false;

  const rawProcedure = normalizeLower(getRawProcedureType(doc));
  if (rawProcedure.includes("visado")) return true;

  return null;
}

function getDocumentStatus(doc = {}) {
  const meta = getMetaContainer(doc);

  return normalizeUpper(
    pickFirstNonEmpty(
      doc.status,
      doc.estado,
      doc.document_status,
      doc.documentStatus,
      meta.status,
      meta.estado,
      meta.document_status,
      meta.documentStatus
    )
  );
}

export function getDocumentKindLabel(doc = {}) {
  const type = normalizeUpper(getRawDocumentKind(doc));
  const rawProcedure = normalizeUpper(getRawProcedureType(doc));

  if (
    [
      "CONTRATO",
      "CONTRACT",
      "CONTRATO_GENERAL",
      "SERVICE_CONTRACT",
      "LABOR_CONTRACT",
      "AGREEMENT",
      "ACUERDO",
    ].includes(type)
  ) {
    return "Contrato";
  }

  if (
    [
      "PODER",
      "POWER",
      "POWER_OF_ATTORNEY",
      "MANDATO",
      "MANDATE",
    ].includes(type)
  ) {
    return "Poder";
  }

  if (
    [
      "AUTORIZACION",
      "AUTORIZACIÓN",
      "AUTHORIZATION",
      "PERMISO",
    ].includes(type)
  ) {
    return "Autorización";
  }

  if (["ANEXO", "ADDENDUM", "ADENDA"].includes(type)) {
    return "Anexo";
  }

  if (["DECLARACION", "DECLARACIÓN", "AFFIDAVIT"].includes(type)) {
    return "Declaración";
  }

  if (["CONTRATO", "CONTRACT", "ACUERDO", "AGREEMENT"].includes(rawProcedure)) {
    return "Contrato";
  }

  if (["PODER", "MANDATO", "POWER", "POWER_OF_ATTORNEY"].includes(rawProcedure)) {
    return "Poder";
  }

  if (
    [
      "AUTORIZACION",
      "AUTORIZACIÓN",
      "AUTHORIZATION",
      "PERMISO",
    ].includes(rawProcedure)
  ) {
    return "Autorización";
  }

  return "";
}

export function getNotaryLabel(doc = {}) {
  const explicitNotary = getRawNotaryFlag(doc);

  if (isTruthyFlag(explicitNotary)) return "Con notaría";
  if (isFalsyFlag(explicitNotary)) return "Sin notaría";

  const rawProcedure = normalizeLower(getRawProcedureType(doc));

  if (
    [
      "notaria",
      "notaría",
      "con notaria",
      "con notaría",
      "con_notaria",
      "con_notaría",
      "notarial",
    ].includes(rawProcedure)
  ) {
    return "Con notaría";
  }

  if (
    [
      "propio",
      "sin notaria",
      "sin notaría",
      "sin_notaria",
      "sin_notaría",
      "general",
    ].includes(rawProcedure)
  ) {
    return "Sin notaría";
  }

  return "";
}

export function getVisadoLabel(doc = {}) {
  const requiresVisado = getRequiresVisado(doc);
  const status = getDocumentStatus(doc);
  const visadoValue = getRawVisadoFlag(doc);

  if (requiresVisado === false) {
    return "Sin visado";
  }

  if (requiresVisado === true) {
    if (status === "PENDIENTE_VISADO") {
      return "Pendiente de visado";
    }

    if (
      [
        "VISADO",
        "PENDIENTE_FIRMA",
        "FIRMADO",
        "SIGNED",
        "COMPLETED",
        "COMPLETADO",
      ].includes(status)
    ) {
      return "Visado registrado";
    }

    if (isTruthyFlag(visadoValue)) {
      return "Visado registrado";
    }

    return "Requiere visado";
  }

  if (isTruthyFlag(visadoValue)) return "Con visado";
  if (isFalsyFlag(visadoValue)) return "Sin visado";

  return "";
}

export function getPrimaryProcedureLabel(doc = {}) {
  const documentKind = getDocumentKindLabel(doc);
  const notaryLabel = getNotaryLabel(doc);

  if (documentKind) return documentKind;
  if (notaryLabel) return notaryLabel;

  return "Documento";
}

export function getProcedureLabel(doc = {}) {
  const documentKind = getDocumentKindLabel(doc);
  const notaryLabel = getNotaryLabel(doc);
  const visadoLabel = getVisadoLabel(doc);

  if (documentKind && notaryLabel) {
    return `${documentKind} · ${notaryLabel}`;
  }

  if (documentKind && visadoLabel) {
    return `${documentKind} · ${visadoLabel}`;
  }

  if (documentKind) return documentKind;
  if (notaryLabel) return notaryLabel;
  if (visadoLabel) return visadoLabel;

  return "Documento";
}

export function getProcedureFieldLabel(doc = {}) {
  const documentKind = getDocumentKindLabel(doc);
  const notaryLabel = getNotaryLabel(doc);
  const visadoLabel = getVisadoLabel(doc);

  if (documentKind && (notaryLabel || visadoLabel)) {
    return "Clasificación";
  }

  if (documentKind) return "Tipo de documento";
  if (notaryLabel) return "Condición notarial";
  if (visadoLabel) return "Condición del flujo";

  return "Documento";
}

export function getDocumentSummaryLabels(doc = {}) {
  return {
    documentKind: getDocumentKindLabel(doc),
    notaryLabel: getNotaryLabel(doc),
    visadoLabel: getVisadoLabel(doc),
    primaryLabel: getPrimaryProcedureLabel(doc),
    procedureLabel: getProcedureLabel(doc),
    fieldLabel: getProcedureFieldLabel(doc),
  };
}