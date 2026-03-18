// src/api/client.js
import axios from "axios";

// 1. Base URL de la API (prod: VITE_API_URL, dev: localhost)
const API_BASE_URL =
  (import.meta.env.VITE_API_URL &&
    import.meta.env.VITE_API_URL.replace(/\/+$/, "")) ||
  "http://localhost:3000/api";

// Log solo en producción para confirmar qué URL usa el bundle
if (!import.meta.env.DEV) {
  console.log("[API BASE URL]", API_BASE_URL);
}

// 2. Instancia principal de Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s para evitar timeouts tontos en Render
  withCredentials: false,
});

// 3. Helpers de sesión
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
  } catch {
    // ignorar errores de storage
  }
  window.location.href = "/login";
}

// 4. Interceptor de request (adjunta token y loguea en dev)
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

// 5. Interceptor de response (maneja 401 y loguea errores en dev)
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
