// src/components/detailView.helpers.js
import { DOC_STATUS } from "../constants";
import {
  DOCUMENT_STATE_META,
  FLOW_ROLE_BADGES,
  FLOW_STATUS_META,
  GLOBAL_REMINDER_ALLOWED_STATUSES,
  STATUS_LABEL_FALLBACK,
} from "./detailView.constants";

export function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback;
}

export function isAbortLikeError(err) {
  return (
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildUserDisplayName(currentUser) {
  return (
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.username ||
    currentUser?.email ||
    "Usuario"
  );
}

/**
 * Tipo de trámite: Notaría / Propio / Sin notaría / N/D
 */
export function getTramiteLabel(value) {
  const normalized = normalizeText(value);

  if (normalized === "notaria" || normalized === "notaría") return "Notaría";
  if (normalized === "propio") return "Propio";
  if (normalized.includes("sin notaria") || normalized.includes("sin notaría")) {
    return "Sin notaría";
  }

  return "N/D";
}

/**
 * Tipo de documento: contratos, poderes, autorizaciones, etc.
 */
export function getDocumentLabel(value) {
  const normalized = normalizeText(value);

  if (
    normalized === "poder" ||
    normalized === "poderes" ||
    normalized === "poderes y autorizaciones"
  ) {
    return "Poderes y autorizaciones";
  }

  if (
    normalized === "contrato" ||
    normalized === "contratos" ||
    normalized === "solo contratos"
  ) {
    return "Solo contratos";
  }

  if (
    normalized === "autorizacion" ||
    normalized === "autorización" ||
    normalized === "autorizaciones"
  ) {
    return "Autorizaciones";
  }

  return "N/D";
}

/**
 * Número interno / número de contrato.
 * Usa primero el número de contrato interno moderno, luego fallback legacy.
 */
export function getDocumentNumber(selectedDoc, timeline) {
  const fromTimeline =
    timeline?.document?.numero_contrato_interno ??
    timeline?.document?.numerocontratointerno ??
    null;

  if (fromTimeline) return fromTimeline;

  const fromSelected =
    selectedDoc?.numero_contrato_interno ||
    selectedDoc?.numerocontratointerno ||
    selectedDoc?.numero_contrato ||
    null;

  return fromSelected;
}

export function getDocumentTitle(selectedDoc, timeline) {
  return (
    timeline?.document?.title ||
    selectedDoc?.title ||
    "Documento sin título"
  );
}

export function getTimelineEvents(timeline, fallbackEvents) {
  if (Array.isArray(timeline?.events) && timeline.events.length > 0) {
    return timeline.events;
  }

  return Array.isArray(fallbackEvents) ? fallbackEvents : [];
}

export function normalizeParticipantRole(value = "") {
  const role = String(value || "").trim().toLowerCase();

  if (role.includes("vis")) return FLOW_ROLE_BADGES.visador;
  if (role.includes("firma") || role.includes("sign")) return FLOW_ROLE_BADGES.firmante;
  if (role.includes("represent")) return FLOW_ROLE_BADGES.representante;
  if (role.includes("owner") || role.includes("propiet")) return FLOW_ROLE_BADGES.propietario;

  return FLOW_ROLE_BADGES.participante;
}

export function normalizeFlowStatus(value = "") {
  const status = String(value || "").trim().toUpperCase();

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

/**
 * Construye el flujo de participantes mezclando document_participants + document_signers
 * y normalizando rol, estado, orden y fechas.
 */
export function buildFlowParticipants(participants = [], signers = []) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const safeSigners = Array.isArray(signers) ? signers : [];

  const signerMapById = new Map(
    safeSigners
      .filter((s) => s?.id != null)
      .map((signer) => [String(signer.id), signer])
  );

  return safeParticipants
    .slice()
    .sort((a, b) => {
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
    })
    .map((participant, index) => {
      const roleInfo = normalizeParticipantRole(
        participant?.role_in_doc || participant?.role
      );
      const statusInfo = normalizeFlowStatus(participant?.status);

      const signerFromId =
        signerMapById.get(String(participant?.signer_id || participant?.id)) ||
        null;

      const normalizedParticipantEmail = String(
        participant?.email || ""
      ).toLowerCase();

      const signerFromEmail =
        !signerFromId && normalizedParticipantEmail
          ? safeSigners.find(
              (s) =>
                String(s?.email || "").toLowerCase() === normalizedParticipantEmail
            )
          : null;

      const signer = signerFromId || signerFromEmail || null;

      const resolvedName =
        participant?.name ||
        signer?.name ||
        signer?.full_name ||
        "Participante";

      const resolvedEmail =
        participant?.email || signer?.email || "Sin correo";

      const resolvedSignedAt =
        participant?.signed_at ||
        participant?.updated_at ||
        signer?.signed_at ||
        null;

      const order = Number.isFinite(Number(participant?.flow_order))
        ? Number(participant.flow_order)
        : index + 1;

      return {
        id:
          participant?.id ||
          participant?.signer_id ||
          `${participant?.email || "participant"}-${index}`,
        order,
        name: resolvedName,
        email: resolvedEmail,
        roleLabel: roleInfo.label,
        roleBadgeClass: roleInfo.badgeClass,
        roleKey: roleInfo.key,
        statusKey: statusInfo.key,
        statusLabel: statusInfo.label,
        statusClassName: statusInfo.className,
        signedAt: resolvedSignedAt,
      };
    });
}

export function buildDocumentStateMeta(status) {
  const normalized = String(status || "").trim().toUpperCase();

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
    helper: "Estado actual del documento.",
  };
}

export function shouldShowVisadoReminder(selectedDoc, currentStatus) {
  return (
    selectedDoc?.requires_visado === true &&
    currentStatus === DOC_STATUS.PENDIENTE_VISADO &&
    !!selectedDoc?.visador_email
  );
}

export function shouldShowGlobalReminder(currentStatus) {
  return GLOBAL_REMINDER_ALLOWED_STATUSES.includes(currentStatus);
}