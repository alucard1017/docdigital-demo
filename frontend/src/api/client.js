// src/api/client.js
import axios from "axios";

const getApiBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL;

  if (raw && raw.trim()) {
    return raw.replace(/\/+$/, ""); // quita barras finales
  }

  return "http://localhost:4000/api";
};

const API_BASE_URL = getApiBaseUrl();

if (import.meta.env.DEV) {
  console.log("[API] Base URL:", API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL, // ej: http://localhost:4000/api
  timeout: 30000,
  withCredentials: false,
});

// Token storage
const getAccessToken = () => {
  try {
    return localStorage.getItem("token") || null;
  } catch {
    return null;
  }
};

const clearSessionAndRedirect = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {}
  window.location.href = "/login";
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
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
    if (import.meta.env.DEV) {
      console.error("[API REQ ERROR]", error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const message = data?.message;

    if (import.meta.env.DEV) {
      console.error("[API RES ERROR]", {
        method: error?.config?.method?.toUpperCase(),
        url: error?.config?.url,
        status,
        message,
      });
    }

    if (status === 401) {
      if (message === "Token expirado" || message === "Token inválido") {
        clearSessionAndRedirect();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
