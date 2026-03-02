// src/utils/subdomain.js
export function getSubdomain() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname; // ej: firmar.verifirma.cl
  const parts = host.split(".");
  if (parts.length < 3) return "";
  return parts[0]; // "app", "firmar", "verificar"
}
