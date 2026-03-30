// src/utils/billing.js
const AOEM_COMPANY_ID = 4; // AOEM SAS

export function isNonExpiringUser(user) {
  if (!user) return false;

  // Tú y admins globales nunca expiran ni pagan
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN_GLOBAL") {
    return true;
  }

  // Toda persona de AOEM SAS
  if (user.company_id === AOEM_COMPANY_ID) {
    return true;
  }

  return false;
}