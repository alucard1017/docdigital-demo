// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function useSocket(token) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("✅ WebSocket conectado");
    });

    socket.on("disconnect", () => {
      console.log("❌ WebSocket desconectado");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Error de WebSocket:", err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const on = useCallback((event, callback) => {
    if (!socketRef.current) return;

    socketRef.current.on(event, callback);
    
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);
  }, []);

  const off = useCallback((event, callback) => {
    if (!socketRef.current) return;
    socketRef.current.off(event, callback);
  }, []);

  return { on, off };
}
