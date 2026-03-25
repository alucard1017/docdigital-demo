// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export function useSocket(token) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return;

    console.log("[WS] Conectando a:", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("✅ WebSocket conectado. id:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ WebSocket desconectado:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Error de WebSocket:", err.message);
    });

    socketRef.current = socket;

    return () => {
      console.log("[WS] Cleanup: desconectando socket");
      // Limpia todos los listeners registrados manualmente
      if (socketRef.current) {
        Object.entries(listenersRef.current).forEach(([event, callbacks]) => {
          callbacks.forEach((cb) => {
            socketRef.current.off(event, cb);
          });
        });
        listenersRef.current = {};
        socketRef.current.disconnect();
        socketRef.current = null;
      } else {
        socket.disconnect();
      }
    };
  }, [token]);

  const on = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on(event, callback);

    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);
  }, []);

  const off = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.off(event, callback);

    if (listenersRef.current[event]) {
      listenersRef.current[event] = listenersRef.current[event].filter(
        (cb) => cb !== callback
      );
      if (listenersRef.current[event].length === 0) {
        delete listenersRef.current[event];
      }
    }
  }, []);

  return { on, off };
}
