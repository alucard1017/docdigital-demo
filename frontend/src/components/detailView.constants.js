// src/components/detailView.constants.js
import { DOC_STATUS } from "../constants";

export const DETAIL_POLL_INTERVAL_MS = 5000;

export const REMINDER_TYPES = {
  VISADO: "VISADO",
  FIRMA: "FIRMA",
};

export const FLOW_ROLE_KEYS = {
  FIRMANTE: "firmante",
  VISADOR: "visador",
  REPRESENTANTE: "representante",
  PROPIETARIO: "propietario",
  PARTICIPANTE: "participante",
};

export const STATUS_LABEL_FALLBACK = "Sin estado";

export const GLOBAL_REMINDER_ALLOWED_STATUSES = [
  DOC_STATUS.PENDIENTE_VISADO,
  DOC_STATUS.PENDIENTE_FIRMA,
];

export const FLOW_ROLE_BADGES = {
  visador: {
    key: FLOW_ROLE_KEYS.VISADOR,
    label: "Visador",
    badgeClass: "detail-flow-badge detail-flow-badge--warning",
  },
  firmante: {
    key: FLOW_ROLE_KEYS.FIRMANTE,
    label: "Firmante",
    badgeClass: "detail-flow-badge detail-flow-badge--info",
  },
  representante: {
    key: FLOW_ROLE_KEYS.REPRESENTANTE,
    label: "Representante",
    badgeClass: "detail-flow-badge detail-flow-badge--neutral",
  },
  propietario: {
    key: FLOW_ROLE_KEYS.PROPIETARIO,
    label: "Propietario",
    badgeClass: "detail-flow-badge detail-flow-badge--neutral",
  },
  participante: {
    key: FLOW_ROLE_KEYS.PARTICIPANTE,
    label: "Participante",
    badgeClass: "detail-flow-badge detail-flow-badge--neutral",
  },
};

export const FLOW_STATUS_META = {
  doneSuccess: {
    key: "done",
    label: "Firmado",
    className: "detail-flow-status detail-flow-status--success",
  },
  doneWarning: {
    key: "done",
    label: "Visado",
    className: "detail-flow-status detail-flow-status--warning",
  },
  rejected: {
    key: "rejected",
    label: "Rechazado",
    className: "detail-flow-status detail-flow-status--danger",
  },
  pending: {
    key: "pending",
    label: "Pendiente",
    className: "detail-flow-status detail-flow-status--pending",
  },
};

export const DOCUMENT_STATE_META = {
  firmado: {
    label: "Firmado",
    className: "detail-doc-state detail-doc-state--success",
    helper: "El flujo del documento ya fue completado.",
  },
  rechazado: {
    label: "Rechazado",
    className: "detail-doc-state detail-doc-state--danger",
    helper: "El documento fue rechazado y el flujo quedó cerrado.",
  },
  pendienteVisado: {
    label: "Pendiente de visado",
    className: "detail-doc-state detail-doc-state--warning",
    helper:
      "Aún falta la aprobación o revisión previa antes de completar la firma.",
  },
  pendienteFirma: {
    label: "Pendiente de firma",
    className: "detail-doc-state detail-doc-state--info",
    helper: "El documento sigue esperando firmas pendientes.",
  },
  pendiente: {
    label: "Pendiente",
    className: "detail-doc-state detail-doc-state--info",
    helper: "El documento está en curso y aún requiere acciones.",
  },
};