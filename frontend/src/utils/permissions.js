export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN_GLOBAL: "ADMIN_GLOBAL",
  ADMIN: "ADMIN",
};

// Idealmente esto luego viene de env/config
const OWNER_ID = 7;

function isOwner(user) {
  return Boolean(user && user.id === OWNER_ID);
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isGlobalAdmin(user) {
  return user?.role === ROLES.ADMIN_GLOBAL;
}

export function isCompanyAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function isAnyAdmin(user) {
  return isSuperAdmin(user) || isGlobalAdmin(user) || isCompanyAdmin(user);
}

// Admin global efectivo (incluye owner)
export function isEffectiveGlobalAdmin(user) {
  if (!user) return false;
  return isOwner(user) || isSuperAdmin(user) || isGlobalAdmin(user);
}

/* ==========
   Permisos de alto nivel
   ========== */

export function canViewAuditLogs(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canManageCompanies(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canManageSystemStatus(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canViewDashboard(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canViewEmailMetrics(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canViewCompanyAnalytics(user) {
  return isEffectiveGlobalAdmin(user);
}

export function canManageUsers(user) {
  return isAnyAdmin(user);
}

export function canViewTemplates(user) {
  return isAnyAdmin(user);
}

export function canManageReminders(user) {
  return isAnyAdmin(user);
}

/* ==========  
   Helpers por vista protegida
   ========== */

export function canAccessProtectedView(user, view) {
  if (!view) return false;

  switch (view) {
    // Vistas comunes para cualquier usuario autenticado
    case "list":
    case "upload":
    case "pricing":
    case "profile":
    case "detail":
      return Boolean(user);

    // Admin scoped (empresa)
    case "users":
      return canManageUsers(user);
    case "templates":
      return canViewTemplates(user);
    case "reminders-config":
      return canManageReminders(user);

    // Admin global (plataforma)
    case "dashboard":
      return canViewDashboard(user);
    case "companies":
      return canManageCompanies(user);
    case "status":
      return canManageSystemStatus(user);
    case "email-metrics":
      return canViewEmailMetrics(user);
    case "company-analytics":
      return canViewCompanyAnalytics(user);
    case "audit-logs":
    case "auth-logs":
      return canViewAuditLogs(user);

    default:
      return false;
  }
}