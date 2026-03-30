// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const buildSocketUrl = () => {
  const rawSocket = import.meta.env.VITE_SOCKET_URL;
  const rawApi = import.meta.env.VITE_API_URL;

  if (typeof rawSocket === "string" && rawSocket.trim()) {
    return rawSocket.trim().replace(/\/+$/, "");
  }

  if (typeof rawApi === "string" && rawApi.trim()) {
    return rawApi
      .trim()
      .replace(/\/api\/?$/i, "") // quita /api o /api/
      .replace(/\/+$/, "");
  }

  return "http://localhost:4000";
};

const SOCKET_URL = buildSocketUrl();

export function useSocket(accessToken) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!accessToken) {
      // Sin token, aseguramos que no quede socket colgado
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        listenersRef.current = {};
      }
      return;
    }

    console.log("[WS] Conectando a:", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("✅ WebSocket conectado. id:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ WebSocket desconectado:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error(
        "❌ Error de WebSocket:",
        err.message,
        err?.data,
        "URL:",
        SOCKET_URL
      );
    });

    socketRef.current = socket;

    return () => {
      console.log("[WS] Cleanup: desconectando socket");
      const currentSocket = socketRef.current || socket;

      if (currentSocket) {
        const entries = Object.entries(listenersRef.current || {});
        entries.forEach(([event, callbacks]) => {
          const safeCallbacks = Array.isArray(callbacks) ? callbacks : [];
          safeCallbacks.forEach((cb) => currentSocket.off(event, cb));
        });

        listenersRef.current = {};
        currentSocket.disconnect();
      }

      socketRef.current = null;
    };
  }, [accessToken]);

  const on = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket || !event || typeof callback !== "function") return;

    socket.on(event, callback);

    if (!Array.isArray(listenersRef.current[event])) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);
  }, []);

  const off = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket || !event || typeof callback !== "function") return;

    socket.off(event, callback);

    if (Array.isArray(listenersRef.current[event])) {
      listenersRef.current[event] = listenersRef.current[event].filter(
        (cb) => cb !== callback
      );
      if (listenersRef.current[event].length === 0) {
        delete listenersRef.current[event];
      }
    }
  }, []);

  // Devuelve siempre un objeto con on/off definido
  return { on, off };
}