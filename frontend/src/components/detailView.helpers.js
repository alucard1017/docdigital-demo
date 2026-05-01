// src/components/detailView.helpers.js
import { DOC_STATUS } from "../constants";
import {
  DOCUMENT_STATE_META,
  FLOW_ROLE_BADGES,
  FLOW_STATUS_META,
  GLOBAL_REMINDER_ALLOWED_STATUSES,
  STATUS_LABEL_FALLBACK,
} from "./detailView.constants";

const DEFAULT_USER_LABEL = "Usuario";
const DEFAULT_DOCUMENT_TITLE = "Documento sin título";
const DEFAULT_PARTICIPANT_NAME = "Participante";
const DEFAULT_EMAIL_LABEL = "Sin correo registrado";
const DEFAULT_DOCUMENT_STATE_HELPER = "Estado actual del documento.";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

export function normalizeText(value) {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
}

export function normalizeUpper(value = "") {
  return String(value ?? "").trim().toUpperCase();
}

export function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export function isAbortLikeError(err) {
  return (
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
}

export function formatDateTime(value, locale = "es-CO") {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildUserDisplayName(currentUser) {
  return (
    pickFirstDefined(
      currentUser?.name,
      currentUser?.fullName,
      currentUser?.username,
      currentUser?.email
    ) || DEFAULT_USER_LABEL
  );
}

export function getDocumentNumber(selectedDoc, timeline) {
  return pickFirstDefined(
    timeline?.document?.numero_contrato_interno,
    timeline?.document?.numerocontratointerno,
    timeline?.document?.numero_contrato,
    selectedDoc?.numero_contrato_interno,
    selectedDoc?.numerocontratointerno,
    selectedDoc?.numero_contrato,
    selectedDoc?.contract_number,
    selectedDoc?.n_contrato
  );
}

export function getDocumentTitle(selectedDoc, timeline) {
  return (
    pickFirstDefined(
      timeline?.document?.title,
      selectedDoc?.title,
      selectedDoc?.nombre
    ) || DEFAULT_DOCUMENT_TITLE
  );
}

export function getTimelineEvents(timeline, fallbackEvents) {
  const primaryEvents = Array.isArray(timeline?.events) ? timeline.events : [];
  if (primaryEvents.length > 0) return primaryEvents;

  const nestedEvents = Array.isArray(timeline?.timeline?.events)
    ? timeline.timeline.events
    : [];
  if (nestedEvents.length > 0) return nestedEvents;

  return Array.isArray(fallbackEvents) ? fallbackEvents : [];
}

function buildFinalSignerRole() {
  return {
    ...FLOW_ROLE_BADGES.firmante,
    label: "Firmante final",
    key: "firmante_final",
  };
}

export function normalizeParticipantRole(value = "") {
  const roleRaw = normalizeText(value);

  if (!roleRaw) {
    return FLOW_ROLE_BADGES.participante;
  }

  if (
    roleRaw === "visador" ||
    roleRaw === "visor" ||
    roleRaw === "visador_final"
  ) {
    return FLOW_ROLE_BADGES.visador;
  }

  if (
    roleRaw === "firmante_final" ||
    roleRaw === "firmante final" ||
    roleRaw === "final" ||
    roleRaw === "signer_final"
  ) {
    return buildFinalSignerRole();
  }

  if (roleRaw === "firmante" || roleRaw === "signer") {
    return FLOW_ROLE_BADGES.firmante;
  }

  if (roleRaw === "representante" || roleRaw === "representante legal") {
    return FLOW_ROLE_BADGES.representante;
  }

  if (roleRaw === "propietario" || roleRaw === "owner") {
    return FLOW_ROLE_BADGES.propietario;
  }

  if (roleRaw.includes("vis")) {
    return FLOW_ROLE_BADGES.visador;
  }

  if (roleRaw.includes("final")) {
    return buildFinalSignerRole();
  }

  if (roleRaw.includes("firma") || roleRaw.includes("sign")) {
    return FLOW_ROLE_BADGES.firmante;
  }

  if (roleRaw.includes("represent")) {
    return FLOW_ROLE_BADGES.representante;
  }

  if (roleRaw.includes("owner") || roleRaw.includes("propiet")) {
    return FLOW_ROLE_BADGES.propietario;
  }

  return FLOW_ROLE_BADGES.participante;
}

export function normalizeFlowStatus(value = "") {
  const status = normalizeUpper(value);

  if (status === DOC_STATUS.FIRMADO || status === "FIRMADO") {
    return FLOW_STATUS_META.doneSuccess;
  }

  if (status === DOC_STATUS.VISADO || status === "VISADO") {
    return FLOW_STATUS_META.doneWarning;
  }

  if (status === DOC_STATUS.RECHAZADO || status === "RECHAZADO") {
    return FLOW_STATUS_META.rejected;
  }

  if (
    status === DOC_STATUS.PENDIENTE ||
    status === DOC_STATUS.PENDIENTE_FIRMA ||
    status === DOC_STATUS.PENDIENTE_VISADO ||
    status === "PENDIENTE" ||
    status === "PENDIENTE_FIRMA" ||
    status === "PENDIENTE_VISADO"
  ) {
    return FLOW_STATUS_META.pending;
  }

  return {
    key: "unknown",
    label: status || STATUS_LABEL_FALLBACK,
    className: "detail-flow-status detail-flow-status--neutral",
  };
}

export function getNormalizedDocumentStatus(selectedDoc, timeline) {
  const raw = pickFirstDefined(
    timeline?.document?.status,
    selectedDoc?.status,
    selectedDoc?.estado
  );

  return normalizeUpper(raw);
}

function resolveParticipantName(participant, signer) {
  return (
    pickFirstDefined(
      participant?.name,
      participant?.full_name,
      participant?.nombre,
      signer?.name,
      signer?.full_name,
      signer?.nombre
    ) || DEFAULT_PARTICIPANT_NAME
  );
}

function resolveParticipantEmail(participant, signer) {
  return (
    pickFirstDefined(
      participant?.email,
      participant?.correo,
      signer?.email,
      signer?.correo
    ) || DEFAULT_EMAIL_LABEL
  );
}

function resolveParticipantSignedAt(participant, signer) {
  return pickFirstDefined(
    participant?.signed_at,
    participant?.updated_at,
    signer?.signed_at,
    signer?.updated_at
  );
}

function resolveParticipantOrder(participant, index) {
  const flowOrder = Number(participant?.flow_order);
  if (Number.isFinite(flowOrder)) return flowOrder;

  const stepOrder = Number(participant?.step_order);
  if (Number.isFinite(stepOrder)) return stepOrder;

  return index + 1;
}

function sortParticipants(a, b) {
  const aOrder = Number.isFinite(Number(a?.flow_order))
    ? Number(a.flow_order)
    : 9999;
  const bOrder = Number.isFinite(Number(b?.flow_order))
    ? Number(b.flow_order)
    : 9999;

  if (aOrder !== bOrder) return aOrder - bOrder;

  const aStep = Number.isFinite(Number(a?.step_order))
    ? Number(a.step_order)
    : 9999;
  const bStep = Number.isFinite(Number(b?.step_order))
    ? Number(b.step_order)
    : 9999;

  if (aStep !== bStep) return aStep - bStep;

  return Number(a?.id || 0) - Number(b?.id || 0);
}

function buildSignerMaps(signers = []) {
  const byId = new Map();
  const byEmail = new Map();

  for (const signer of signers) {
    if (signer?.id != null) {
      byId.set(String(signer.id), signer);
    }

    const email = normalizeText(signer?.email || signer?.correo);
    if (email) {
      byEmail.set(email, signer);
    }
  }

  return { byId, byEmail };
}

export function buildFlowParticipants(participants = [], signers = []) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const safeSigners = Array.isArray(signers) ? signers : [];
  const signerMaps = buildSignerMaps(safeSigners);

  return safeParticipants
    .slice()
    .sort(sortParticipants)
    .map((participant, index) => {
      const roleInfo = normalizeParticipantRole(
        participant?.role_in_doc || participant?.role
      );

      const statusInfo = normalizeFlowStatus(participant?.status);

      const signerFromId =
        signerMaps.byId.get(String(participant?.signer_id || participant?.id)) ||
        null;

      const normalizedParticipantEmail = normalizeText(
        participant?.email || participant?.correo
      );

      const signerFromEmail =
        !signerFromId && normalizedParticipantEmail
          ? signerMaps.byEmail.get(normalizedParticipantEmail) || null
          : null;

      const signer = signerFromId || signerFromEmail || null;

      return {
        id:
          participant?.id ||
          participant?.signer_id ||
          `${participant?.email || participant?.correo || "participant"}-${index}`,
        order: resolveParticipantOrder(participant, index),
        name: resolveParticipantName(participant, signer),
        email: resolveParticipantEmail(participant, signer),
        roleLabel: roleInfo.label,
        roleBadgeClass: roleInfo.badgeClass,
        roleKey: roleInfo.key,
        statusKey: statusInfo.key,
        statusLabel: statusInfo.label,
        statusClassName: statusInfo.className,
        signedAt: resolveParticipantSignedAt(participant, signer),
      };
    });
}

export function buildDocumentStateMeta(status) {
  const normalized = normalizeUpper(status);

  if (normalized === DOC_STATUS.FIRMADO) {
    return DOCUMENT_STATE_META.firmado;
  }

  if (normalized === DOC_STATUS.RECHAZADO) {
    return DOCUMENT_STATE_META.rechazado;
  }

  if (normalized === DOC_STATUS.PENDIENTE_VISADO) {
    return DOCUMENT_STATE_META.pendienteVisado;
  }

  if (normalized === DOC_STATUS.PENDIENTE_FIRMA) {
    return DOCUMENT_STATE_META.pendienteFirma;
  }

  if (normalized === DOC_STATUS.PENDIENTE) {
    return DOCUMENT_STATE_META.pendiente;
  }

  return {
    label: normalized || STATUS_LABEL_FALLBACK,
    className: "detail-doc-state detail-doc-state--neutral",
    helper: DEFAULT_DOCUMENT_STATE_HELPER,
  };
}

export function shouldShowVisadoReminder(selectedDoc, currentStatus) {
  return (
    selectedDoc?.requires_visado === true &&
    currentStatus === DOC_STATUS.PENDIENTE_VISADO &&
    isNonEmptyString(selectedDoc?.visador_email)
  );
}

export function shouldShowGlobalReminder(currentStatus) {
  return GLOBAL_REMINDER_ALLOWED_STATUSES.includes(currentStatus);
}