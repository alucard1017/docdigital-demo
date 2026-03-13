// src/api/docs.js
import api from "./client";

// Crear documento
export async function createDocument(formData) {
  const res = await api.post("/docs", formData);
  return res.data;
}

// Stats de documentos
export async function getDocsStats() {
  const res = await api.get("/docs/stats");
  return res.data;
}

// Timeline de un documento
export async function getDocumentTimeline(id) {
  const res = await api.get(`/docs/${id}/timeline`);
  return res.data;
}

// PDF de un documento (devuelve blob)
export async function getDocumentPdf(id) {
  const res = await api.get(`/docs/${id}/pdf`, { responseType: "blob" });
  return res.data;
}

// Reenviar documento
export async function resendDocument(id) {
  const res = await api.post(`/docs/${id}/reenviar`);
  return res.data;
}

// Enviar recordatorio
export async function sendReminder(id) {
  const res = await api.post(`/docs/${id}/recordatorio`);
  return res.data;
}

// Descargar documento firmado: devuelve URL completa
export function getDocumentDownloadUrl(id) {
  // Usa baseURL del client
  const base = api.defaults.baseURL || "";
  return `${base}/docs/${id}/download`;
}
