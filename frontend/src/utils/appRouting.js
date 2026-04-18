// src/utils/appRouting.js

export const ROUTE_MAP = {
  "/": "list",
  "/documents": "list",
  "/new-document": "upload",
  "/users": "users",
  "/dashboard": "dashboard",
  "/companies": "companies",
  "/status": "status",
  "/audit-logs": "audit-logs",
  "/auth-logs": "auth-logs",
  "/reminders-config": "reminders-config",
  "/email-metrics": "email-metrics",
  "/pricing": "pricing",
  "/profile": "profile",
  "/templates": "templates",
  "/company-analytics": "company-analytics",
};

export const VIEW_TO_PATH = {
  list: "/documents",
  upload: "/new-document",
  users: "/users",
  dashboard: "/dashboard",
  companies: "/companies",
  status: "/status",
  "audit-logs": "/audit-logs",
  "auth-logs": "/auth-logs",
  "reminders-config": "/reminders-config",
  "email-metrics": "/email-metrics",
  pricing: "/pricing",
  profile: "/profile",
  templates: "/templates",
  "company-analytics": "/company-analytics",
};

export const VALID_PROTECTED_VIEWS = new Set(Object.values(ROUTE_MAP));

export const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
]);

export function getProtectedViewFromPath(path) {
  return ROUTE_MAP[path] || "list";
}

export function getLocationSnapshot() {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "" };
  }

  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
  };
}

export function getPublicAccessSnapshot({
  pathname,
  search,
  isSigningPortal,
  isVerificationPortal,
}) {
  const params = new URLSearchParams(search || "");
  const queryToken = (params.get("token") || "").trim();

  const normalizedPath = pathname || "/";
  const documentPathMatch = normalizedPath.match(/^\/document\/([^/?#]+)$/i);
  const documentTokenFromPath = documentPathMatch?.[1]?.trim() || "";

  const tokenFromUrl = queryToken || documentTokenFromPath;

  const isPublicSigningAccess =
    (!!queryToken &&
      (normalizedPath === "/public/sign" ||
        normalizedPath === "/firma-publica" ||
        normalizedPath === "/consulta-publica" ||
        (isSigningPortal && normalizedPath === "/"))) ||
    (!!documentTokenFromPath &&
      (normalizedPath.startsWith("/document/") ||
        (isSigningPortal && normalizedPath.startsWith("/document/"))));

  const isPublicVerificationAccess =
    normalizedPath === "/verificar" ||
    normalizedPath === "/verificacion-publica" ||
    (isVerificationPortal && normalizedPath === "/");

  return {
    tokenFromUrl,
    isPublicSigningAccess,
    isPublicVerificationAccess,
    isAnyPublicAccess: isPublicSigningAccess || isPublicVerificationAccess,
    isDocumentTokenPath: !!documentTokenFromPath,
  };
}

export function getEffectivePublicRouteState({
  search,
  isDocumentTokenPath,
}) {
  const params = new URLSearchParams(search || "");
  const rawMode = (params.get("mode") || "").trim().toLowerCase();

  if (isDocumentTokenPath) {
    return {
      effectivePublicModeFromUrl: "visado",
      effectiveTokenKindFromUrl: "document",
    };
  }

  const mode =
    rawMode === "visado" || rawMode === "visa"
      ? "visado"
      : rawMode === "firma"
      ? "firma"
      : "";

  const effectivePublicModeFromUrl = mode || "firma";
  const effectiveTokenKindFromUrl =
    effectivePublicModeFromUrl === "visado" ? "document" : "signer";

  return {
    effectivePublicModeFromUrl,
    effectiveTokenKindFromUrl,
  };
}

/**
 * Helper puro para decidir la pantalla principal.
 * No renderiza componentes; sólo devuelve una decisión serializable.
 */
export function resolveAppEntry({
  authLoading,
  isAuthenticated,
  path,
  publicAccess,
}) {
  if (authLoading) {
    return { screen: "session-loading" };
  }

  if (publicAccess?.isPublicVerificationAccess) {
    return { screen: "public-verification" };
  }

  if (publicAccess?.isPublicSigningAccess) {
    return { screen: "public-sign" };
  }

  if (!isAuthenticated && path === "/forgot-password") {
    return { screen: "forgot-password" };
  }

  if (!isAuthenticated && path === "/reset-password") {
    return { screen: "reset-password" };
  }

  if (!isAuthenticated && path === "/register") {
    return { screen: "register" };
  }

  if (!isAuthenticated) {
    return { screen: "login" };
  }

  return { screen: "protected-app" };
}