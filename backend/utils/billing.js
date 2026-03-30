// backend/utils/billing.js

// AOEM SAS tiene company_id = 4
const AOEM_COMPANY_ID = 4;

/**
 * Usuarios que NO deben pagar ni tener plan que caduque:
 * - SUPER_ADMIN
 * - ADMIN_GLOBAL
 * - Cualquier usuario de la empresa AOEM SAS (company_id = 4)
 */
function isNonExpiringUser(user) {
  if (!user) return false;

  // Roles globales
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN_GLOBAL") {
    return true;
  }

  // Empresa interna de pruebas AOEM SAS
  if (user.company_id === AOEM_COMPANY_ID) {
    return true;
  }

  return false;
}

module.exports = {
  isNonExpiringUser,
  AOEM_COMPANY_ID,
};