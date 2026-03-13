// src/api/client.js
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
});

// Helper para leer token (por si luego cambias de localStorage a otra cosa)
function getAccessToken() {
  try {
    return localStorage.getItem("token") || null;
  } catch {
    return null;
  }
}

function clearSessionAndRedirect() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Opcional: guarda ruta actual para volver después del login
    // localStorage.setItem("redirectAfterLogin", window.location.pathname);
  } catch {
    // ignorar errores de storage
  }
  window.location.href = "/login";
}

// REQUEST INTERCEPTOR: adjuntar token y logs útiles
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.debug("[API REQUEST]", {
        url: config.url,
        method: config.method,
        baseURL: config.baseURL,
        hasToken: !!token,
      });
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error("[API REQUEST ERROR]", error);
    }
    return Promise.reject(error);
  }
);

// RESPONSE INTERCEPTOR: manejar 401 y logs de error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    if (import.meta.env.DEV) {
      console.error("[API RESPONSE ERROR]", {
        url: error?.config?.url,
        method: error?.config?.method,
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
