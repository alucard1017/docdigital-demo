export const API_BASE_URL = 'https://verifirma-api.onrender.com';
export function apiUrl(path = "") {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
export const DOC_STATUS = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_VISADO: "PENDIENTE_VISADO", 
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  VISADO: "VISADO",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO"
};
