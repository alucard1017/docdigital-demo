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
]);

const normalizeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

export const isAuthFailure = (status, message, code) => {
  if (status !== 401) return false;

  const normalizedCode = normalizeUpper(code);
  const normalizedMessage = normalizeLower(message);

  if (AUTH_FAILURE_CODES.has(normalizedCode)) {
    return true;
  }

  return AUTH_FAILURE_MESSAGES.has(normalizedMessage);
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
        source: "http",
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

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.debug("[API REQ]", {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        hasToken: !!token,
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

    if (import.meta.env.DEV) {
      console.error("[API RES ERROR]", {
        method,
        url,
        status,
        message,
        code: errorCode,
      });
    }

    if (isAuthFailure(status, message, errorCode)) {
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