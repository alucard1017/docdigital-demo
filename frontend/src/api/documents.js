// frontend/src/api/documents.js
import api from "./client";

export async function createMultiPartyDocument(payload) {
  // payload con shape:
  // {
  //   title, description, fileUrl, flowType, category, expiresAt, signers: [...]
  // }
  const res = await api.post("/documents/multi-party", payload);
  return res.data;
}