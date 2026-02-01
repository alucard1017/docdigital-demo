// src/constants.js
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const DOC_STATUS = {
  PENDIENTE: 'PENDIENTE',
  VISADO: 'VISADO',
  FIRMADO: 'FIRMADO',
  RECHAZADO: 'RECHAZADO',
};
