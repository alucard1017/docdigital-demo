// frontend/src/api/client.js
import axios from "axios";
import { getStoredToken } from "../utils/session";

export const getApiBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL;

  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/+$/, "");
  }

  return "http://localhost:4000/api";
};

export const API_BASE_URL = getApiBaseUrl();

if (import.meta.env.DEV) {
  console.log("[API] Base URL:", API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

let authExpiredDispatched = false;

const AUTH_FAILURE_CODES = new Set([
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  "UNAUTHORIZED",
  "AUTH_REQUIRED",
  "INVALID_TOKEN",
  "SESSION_EXPIRED",
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
  "forbidden",
]);

const PUBLIC_PATH_PREFIXES = [
  "/public",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const normalizeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const normalizeUrlPath = (url = "") => {
  const value = normalizeText(url);

  if (!value) return "";

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      return parsed.pathname || "";
    }

    return value.startsWith("/") ? value : `/${value}`;
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
};

export const isPublicRequest = (url = "") => {
  const path = normalizeUrlPath(url);

  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
};

export const isAuthFailure = (status, message, code) => {
  if (status !== 401 && status !== 403) return false;

  const normalizedCode = normalizeUpper(code);
  const normalizedMessage = normalizeLower(message);

  if (AUTH_FAILURE_CODES.has(normalizedCode)) {
    return true;
  }

  if (AUTH_FAILURE_MESSAGES.has(normalizedMessage)) {
    return true;
  }

  return status === 401;
};

export const isRequestCanceled = (error) => {
  if (!error) return false;

  return (
    axios.isCancel(error) ||
    error?.code === "ERR_CANCELED" ||
    normalizeLower(error?.message) === "canceled"
  );
};

export const dispatchAuthExpired = (detail = {}) => {
  if (authExpiredDispatched) return false;

  authExpiredDispatched = true;

  window.dispatchEvent(
    new CustomEvent("auth:expired", {
      detail: {
        source: detail.source ?? "http",
        status: detail.status ?? 401,
        code: detail.code ?? null,
        message:
          detail.message ||
          "Tu sesión expiró o ya no es válida. Debes iniciar sesión nuevamente.",
        url: detail.url ?? null,
        method: detail.method ?? null,
      },
    })
  );

  return true;
};

export const resetAuthExpiredDispatch = () => {
  authExpiredDispatched = false;
};

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    if (token && !isPublicRequest(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.debug("[API REQ]", {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        hasToken: !!token,
        isPublic: isPublicRequest(config.url),
      });
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV && !isRequestCanceled(error)) {
      console.error("[API REQ ERROR]", error);
    }

    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isRequestCanceled(error)) {
      if (import.meta.env.DEV) {
        console.debug("[API RES CANCELED]", {
          method: error?.config?.method?.toUpperCase() ?? null,
          url: error?.config?.url ?? null,
        });
      }

      return Promise.reject(error);
    }

    const status = error?.response?.status ?? null;
    const data = error?.response?.data ?? null;
    const message = data?.message || error?.message || "";
    const errorCode = data?.code || null;
    const method = error?.config?.method?.toUpperCase() ?? null;
    const url = error?.config?.url ?? null;
    const publicRequest = isPublicRequest(url);

    if (import.meta.env.DEV) {
      console.error("[API RES ERROR]", {
        method,
        url,
        status,
        message,
        code: errorCode,
        isPublic: publicRequest,
      });
    }

    if (!publicRequest && isAuthFailure(status, message, errorCode)) {
      dispatchAuthExpired({
        source: "http",
        status,
        code: errorCode,
        message,
        method,
        url,
      });
    }

    return Promise.reject(error);
  }
);

export async function getDocumentTimeline(id, config = {}) {
  const res = await api.get(`/documents/${id}/timeline`, config);
  return res.data;
}

export default api;