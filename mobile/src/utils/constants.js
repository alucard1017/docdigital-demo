// mobile/src/utils/constants.js

export const DOCUMENT_STATUS = {
  PENDING: 'PENDIENTE_FIRMA',
  SIGNED: 'FIRMADO',
  REJECTED: 'RECHAZADO',
  PENDING_REVIEW: 'PENDIENTE_VISTO_BUENO',
  COMPLETED: 'COMPLETADO',
};

export const DOCUMENT_STATUS_LABELS = {
  [DOCUMENT_STATUS.PENDING]: 'Pendiente',
  [DOCUMENT_STATUS.SIGNED]: 'Firmado',
  [DOCUMENT_STATUS.REJECTED]: 'Rechazado',
  [DOCUMENT_STATUS.PENDING_REVIEW]: 'En Revisión',
  [DOCUMENT_STATUS.COMPLETED]: 'Completado',
};

export const DOCUMENT_STATUS_COLORS = {
  [DOCUMENT_STATUS.PENDING]: '#f59e0b',
  [DOCUMENT_STATUS.SIGNED]: '#10b981',
  [DOCUMENT_STATUS.REJECTED]: '#ef4444',
  [DOCUMENT_STATUS.PENDING_REVIEW]: '#3b82f6',
  [DOCUMENT_STATUS.COMPLETED]: '#10b981',
};

export const SIGNATURE_ROLES = {
  OWNER: 'OWNER',
  SIGNER: 'SIGNER',
  REVIEWER: 'REVIEWER',
};

export const API_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  DOCUMENTS: '/documents',
  DOCUMENT_DETAIL: '/documents/:id',
  SIGN_DOCUMENT: '/documents/:id/sign',
  REJECT_DOCUMENT: '/documents/:id/reject',
  REVIEW_DOCUMENT: '/documents/:id/review',
};