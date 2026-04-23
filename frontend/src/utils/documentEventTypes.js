// frontend/src/utils/documentEventTypes.js

// Mantener en sync con backend/controllers/documents/documentEventTypes.js
export const DOCUMENT_EVENT_TYPES = {
  // Creación / envío
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_SENT: "DOCUMENT_SENT",

  // Firma / visado / rechazo internos (propietario / usuarios internos)
  DOCUMENT_SIGNED_OWNER: "DOCUMENT_SIGNED_OWNER",
  DOCUMENT_VISADO_OWNER: "DOCUMENT_VISADO_OWNER",
  DOCUMENT_REJECTED_OWNER: "DOCUMENT_REJECTED_OWNER",

  // Firma / visado / rechazo desde enlace público
  SIGNED_PUBLIC: "SIGNED_PUBLIC",
  VISADO_PUBLIC: "VISADO_PUBLIC",
  REJECTED_PUBLIC: "REJECTED_PUBLIC",

  // Cambios de estado genéricos
  STATUS_CHANGED: "STATUS_CHANGED",

  // Apertura de enlaces públicos
  PUBLIC_LINK_OPENED_SIGNER: "PUBLIC_LINK_OPENED_SIGNER",
  PUBLIC_LINK_OPENED_VISADOR: "PUBLIC_LINK_OPENED_VISADOR",
  INVITATION_OPENED: "INVITATION_OPENED",

  // Verificación
  VERIFY_PUBLIC_CODE: "VERIFY_PUBLIC_CODE",
};