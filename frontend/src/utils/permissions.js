export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN_GLOBAL: "ADMIN_GLOBAL",
  ADMIN: "ADMIN",
};

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
  return (
    isSuperAdmin(user) ||
    isGlobalAdmin(user) ||
    isCompanyAdmin(user)
  );
}

export function canViewAuditLogs(user) {
  return isSuperAdmin(user) || isGlobalAdmin(user);
}

export function canManageCompanies(user) {
  return isAnyAdmin(user);
}

export function canManageUsers(user) {
  return isAnyAdmin(user);
}

export function canViewTemplates(user) {
  return isAnyAdmin(user);
}

export function canViewCompanyAnalytics(user) {
  return isAnyAdmin(user);
}