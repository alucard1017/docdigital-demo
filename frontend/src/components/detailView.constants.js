// src/components/detailView.constants.js
import { DOC_STATUS } from "../constants";

/**
 * Intervalo de polling del detalle (ms).
 * Mantenerlo moderado para evitar saturar el backend.
 */
export const DETAIL_POLL_INTERVAL_MS = 5000;

/**
 * Tipos de recordatorio soportados por el backend.
 */
export const REMINDER_TYPES = {
  VISADO: "VISADO",
  FIRMA: "FIRMA",
};

/**
 * Claves de roles dentro del flujo de participantes.
 */
export const FLOW_ROLE_KEYS = {
  FIRMANTE: "firmante",
  VISADOR: "visador",
  REPRESENTANTE: "representante",
  PROPIETARIO: "propietario",
  PARTICIPANTE: "participante",
};

export const STATUS_LABEL_FALLBACK = "Sin estado";

/**
 * Estados del documento en los que tiene sentido permitir
 * el botón de "Recordar a todos".
 */
export const GLOBAL_REMINDER_ALLOWED_STATUSES = [
  DOC_STATUS.PENDIENTE_VISADO,
  DOC_STATUS.PENDIENTE_FIRMA,
];

/**
 * Configuración visual de badges por rol.
 * (Los textos siguen en español aquí; si luego quieres i18n,
 * basta con mapear label vía t() en el componente).
 */
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

/**
 * Meta para mostrar el estado de cada participante dentro del flujo.
 */
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

/**
 * Meta para el "estado global" del documento en el header del detalle.
 */
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