// frontend/src/api/client.js
import axios from "axios";
import { getStoredToken } from "../utils/session";

/* ============================
   Constantes base
   ============================ */

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

/* ============================
   Normalización de texto / URLs
   ============================ */

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const ensureLeadingSlash = (value = "") => {
  const v = normalizeText(value);
  if (!v) return "/";
  return v.startsWith("/") ? v : `/${v}`;
};

const stripTrailingSlashes = (value = "") =>
  normalizeText(value).replace(/\/+$/, "");

const ensureApiSuffix = (value = "") => {
  const clean = stripTrailingSlashes(value);
  if (!clean) return DEFAULT_API_BASE_URL;
  return clean.endsWith("/api") ? clean : `${clean}/api`;
};

/* ============================
   Base URL / helpers
   ============================ */

export const getApiBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL;

  if (typeof raw === "string" && raw.trim()) {
    return ensureApiSuffix(raw);
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = getApiBaseUrl();

export const buildApiUrl = (path = "") => {
  const cleanPath = ensureLeadingSlash(path);
  return `${stripTrailingSlashes(API_BASE_URL)}${cleanPath}`;
};

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log("[API] Base URL:", API_BASE_URL);
}

/* ============================
   Instancia Axios
   ============================ */

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

/* ============================
   Flags / sets de códigos
   ============================ */

let authExpiredDispatched = false;

const AUTH_FAILURE_CODES = new Set([
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  "UNAUTHORIZED",
  "AUTH_REQUIRED",
  "INVALID_TOKEN",
  "SESSION_EXPIRED",
  "JWT_EXPIRED",
  "INVALID_JWT",
]);

const AUTH_FAILURE_MESSAGES = new Set([
  "token expirado",
  "token inválido",
  "token invalido",
  "no autorizado",
  "usuario no válido",
  "usuario no valido",
  "jwt expired",
  "unauthorized",
  "invalid token",
  "session expired",
  "authentication required",
  "auth required",
]);

const FORBIDDEN_MESSAGES = new Set([
  "forbidden",
  "prohibido",
  "acceso denegado",
  "permiso denegado",
  "insufficient permissions",
  "insufficient permission",
  "not enough permissions",
]);

const PUBLIC_PATH_PREFIXES = [
  "/public",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// rutas donde un 401 NO debe provocar logout global
const AUTH_IGNORED_401_PATHS = [/^\/documents\/\d+\/timeline$/i];

/* ============================
   Helpers de request / response
   ============================ */

const normalizeUrlPath = (url = "") => {
  const value = normalizeText(url);
  if (!value) return "";

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      return parsed.pathname || "";
    }
    return ensureLeadingSlash(value);
  } catch {
    return ensureLeadingSlash(value);
  }
};

const getRequestMethod = (configOrError) =>
  configOrError?.method?.toUpperCase?.() ||
  configOrError?.config?.method?.toUpperCase?.() ||
  null;

const getRequestUrl = (configOrError) =>
  configOrError?.url || configOrError?.config?.url || null;

const getFullRequestUrl = (configOrError) => {
  const baseURL =
    configOrError?.baseURL || configOrError?.config?.baseURL || "";
  const url = getRequestUrl(configOrError) || "";
  return `${stripTrailingSlashes(baseURL)}${ensureLeadingSlash(url)}`;
};

export const isPublicRequest = (url = "") => {
  const path = normalizeUrlPath(url);
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
};

export const isRequestCanceled = (error) => {
  if (!error) return false;
  return (
    axios.isCancel(error) ||
    error?.code === "ERR_CANCELED" ||
    normalizeLower(error?.message) === "canceled"
  );
};

const extractErrorMeta = (error) => {
  const status = error?.response?.status ?? null;
  const data = error?.response?.data ?? null;
  const message = data?.message || error?.message || "";
  const code = data?.code || null;

  const method = getRequestMethod(error);
  const url = getRequestUrl(error);
  const fullUrl = getFullRequestUrl(error);
  const publicRequest = isPublicRequest(url);
  const path = normalizeUrlPath(url);

  return {
    status,
    data,
    message,
    code,
    method,
    url,
    fullUrl,
    publicRequest,
    path,
  };
};

/* ============================
   Detección de auth expirado
   ============================ */

const isIgnoredAuth401 = (path = "") =>
  AUTH_IGNORED_401_PATHS.some((re) => re.test(path));

export const isAuthFailure = (status, message, code, path = "") => {
  const normalizedCode = normalizeUpper(code);
  const normalizedMessage = normalizeLower(message);

  if (status === 401) {
    if (isIgnoredAuth401(path)) {
      return false;
    }
    if (AUTH_FAILURE_CODES.has(normalizedCode)) return true;
    if (AUTH_FAILURE_MESSAGES.has(normalizedMessage)) return true;
    // Por diseño: cualquier 401 no público se trata como fallo de auth
    return true;
  }

  if (status === 403) {
    if (AUTH_FAILURE_CODES.has(normalizedCode)) return true;
    if (AUTH_FAILURE_MESSAGES.has(normalizedMessage)) return true;

    if (FORBIDDEN_MESSAGES.has(normalizedMessage)) return false;
    return false;
  }

  return false;
};

export const dispatchAuthExpired = (detail = {}) => {
  if (authExpiredDispatched) return false;
  if (typeof window === "undefined") return false;

  authExpiredDispatched = true;

  const safeDetail = {
    source: detail.source ?? "http",
    status: detail.status ?? 401,
    code: detail.code ?? null,
    message:
      detail.message ||
      "Tu sesión expiró o ya no es válida. Debes iniciar sesión nuevamente.",
    url: detail.url ?? null,
    fullUrl: detail.fullUrl ?? null,
    method: detail.method ?? null,
  };

  try {
    window.dispatchEvent(
      new CustomEvent("auth:expired", {
        detail: safeDetail,
      })
    );
    return true;
  } catch (err) {
    authExpiredDispatched = false;

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[API AUTH] error disparando auth:expired:", err);
    }

    return false;
  }
};

export const resetAuthExpiredDispatch = () => {
  authExpiredDispatched = false;
};

/* ============================
   Interceptor de request
   ============================ */

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    // Forzar path relativo limpio
    config.url = ensureLeadingSlash(config.url || "");

    if (token && !isPublicRequest(config.url)) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[API REQ]", {
        method: getRequestMethod(config),
        url: config.url,
        baseURL: config.baseURL,
        fullUrl: getFullRequestUrl(config),
        params: config.params ?? null,
        hasToken: !!token,
        isPublic: isPublicRequest(config.url),
      });
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV && !isRequestCanceled(error)) {
      // eslint-disable-next-line no-console
      console.error("[API REQ ERROR]", error);
    }

    return Promise.reject(error);
  }
);

/* ============================
   Interceptor de response
   ============================ */

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isRequestCanceled(error)) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[API RES CANCELED]", {
          method: getRequestMethod(error),
          url: getRequestUrl(error),
        });
      }
      return Promise.reject(error);
    }

    const {
      status,
      data,
      message,
      code,
      method,
      url,
      fullUrl,
      publicRequest,
      path,
    } = extractErrorMeta(error);

    // Errores de red / CORS (sin status): ayuda a depurar en prod
    if (status == null) {
      if (!import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[API RES NETWORK ERROR]", {
          method,
          url,
          fullUrl,
          message,
          code,
        });
      }
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[API RES ERROR]", {
        method,
        url,
        fullUrl,
        status,
        message,
        code,
        isPublic: publicRequest,
        responseData: data,
      });
    }

    if (!publicRequest && isAuthFailure(status, message, code, path)) {
      dispatchAuthExpired({
        source: "http",
        status,
        code,
        message,
        method,
        url,
        fullUrl,
      });
    }

    return Promise.reject(error);
  }
);

/* ============================
   Helpers REST específicos
   ============================ */

// /docs → { data, pagination, stats }
export async function getDocuments(params = {}, config = {}) {
  const res = await api.get("/docs", { ...config, params });
  return res.data;
}

export async function getDocumentById(id, config = {}) {
  const res = await api.get(`/documents/${id}`, config);
  return res.data;
}

export async function getDocumentPreview(id, config = {}) {
  const res = await api.get(`/documents/${id}/preview`, {
    ...config,
    responseType: config.responseType || "blob",
  });
  return res.data;
}

export async function getDocumentPdfUrl(id, config = {}) {
  const res = await api.get(`/docs/${id}/pdf`, config);
  return res.data;
}

/**
 * Timeline “pro”: debe devolver:
 * {
 *   document: {...},
 *   participants: [...],
 *   events: [...],
 * }
 */
export async function getDocumentTimeline(id, config = {}) {
  const res = await api.get(`/documents/${id}/timeline`, config);
  return res.data;
}

/* ============================
   Público (token de firma / verificación)
   ============================ */

export async function getPublicVerificationByCode(code, config = {}) {
  const res = await api.get(
    `/public/verificar/${encodeURIComponent(code)}`,
    config
  );
  return res.data;
}

export async function getPublicDocumentByToken(token, config = {}) {
  const res = await api.get(
    `/public/docs/${encodeURIComponent(token)}`,
    config
  );
  return res.data;
}

export async function publicSignDocument(token, config = {}) {
  const res = await api.post(
    `/public/docs/${encodeURIComponent(token)}/firmar`,
    {},
    config
  );
  return res.data;
}

export async function publicVisarDocument(token, config = {}) {
  const res = await api.post(
    `/public/docs/${encodeURIComponent(token)}/visar`,
    {},
    config
  );
  return res.data;
}

export async function publicRejectDocument(token, motivo, config = {}) {
  const res = await api.post(
    `/public/docs/${encodeURIComponent(token)}/rechazar`,
    { motivo },
    config
  );
  return res.data;
}

export default api;