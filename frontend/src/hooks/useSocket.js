// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { io } from "socket.io-client";

function isBrowser() {
  return typeof window !== "undefined";
}

function buildSocketUrl() {
  const rawSocket = import.meta.env.VITE_SOCKET_URL;
  const rawApi = import.meta.env.VITE_API_URL;

  if (typeof rawSocket === "string" && rawSocket.trim()) {
    return rawSocket.trim().replace(/\/+$/, "");
  }

  if (typeof rawApi === "string" && rawApi.trim()) {
    return rawApi
      .trim()
      .replace(/\/api\/?$/i, "")
      .replace(/\/+$/, "");
  }

  return "http://localhost:4000";
}

function isAuthLikeErrorMessage(message) {
  if (!message || typeof message !== "string") return false;

  return /jwt expired|unauthorized|authentication|invalid token|token inválido|token invalido|no autorizado|usuario no válido|usuario no valido/i.test(
    message
  );
}

export function useSocket(accessToken, options = {}) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});
  const authExpiredHandledRef = useRef(false);
  const [connected, setConnected] = useState(false);

  const socketUrl = useMemo(() => buildSocketUrl(), []);
  const normalizedToken =
    typeof accessToken === "string" ? accessToken.trim() : "";

  const clearAllListeners = useCallback((socketInstance) => {
    if (!socketInstance) return;

    const registry =
      listenersRef.current && typeof listenersRef.current === "object"
        ? listenersRef.current
        : {};

    Object.entries(registry).forEach(([event, callbacks]) => {
      if (!(callbacks instanceof Set)) return;

      callbacks.forEach((cb) => {
        try {
          socketInstance.off(event, cb);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[WS] error removiendo listener:", event, err);
          }
        }
      });
    });

    listenersRef.current = {};
  }, []);

  const hardDisconnect = useCallback(
    (socketInstance) => {
      if (!socketInstance) return;

      clearAllListeners(socketInstance);

      try {
        socketInstance.off("connect");
        socketInstance.off("disconnect");
        socketInstance.off("connect_error");
        socketInstance.off("error");
        socketInstance.off("auth_error");
      } catch (_) {}

      try {
        socketInstance.removeAllListeners?.();
      } catch (_) {}

      try {
        socketInstance.disconnect();
      } catch (_) {}
    },
    [clearAllListeners]
  );

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    hardDisconnect(socket);
    socketRef.current = null;
    setConnected(false);
  }, [hardDisconnect]);

  useEffect(() => {
    authExpiredHandledRef.current = false;

    if (!isBrowser()) {
      return;
    }

    if (!normalizedToken) {
      disconnect();
      return;
    }

    if (socketRef.current) {
      disconnect();
    }

    const socket = io(socketUrl, {
      auth: { token: normalizedToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts:
        typeof options.reconnectionAttempts === "number"
          ? options.reconnectionAttempts
          : 5,
      reconnectionDelay:
        typeof options.reconnectionDelay === "number"
          ? options.reconnectionDelay
          : 1500,
    });

    const handleConnect = () => {
      setConnected(true);
      authExpiredHandledRef.current = false;

      if (import.meta.env.DEV) {
        console.log("[WS] conectado");
      }
    };

    const handleDisconnect = (reason) => {
      setConnected(false);

      if (import.meta.env.DEV) {
        console.warn("[WS] desconectado:", reason);
      }
    };

    const maybeDispatchAuthExpired = (detail = {}) => {
      if (!isBrowser()) return;
      if (authExpiredHandledRef.current) return;

      authExpiredHandledRef.current = true;

      try {
        window.dispatchEvent(
          new CustomEvent("auth:expired", {
            detail: {
              source: "ws",
              ...detail,
            },
          })
        );
      } catch (eventErr) {
        console.error("[WS AUTH] error disparando auth:expired:", eventErr);
      }
    };

    const handleConnectError = (err) => {
      setConnected(false);

      const message =
        err?.message || err?.data?.message || "Error de conexión WS";

      if (import.meta.env.DEV) {
        console.error("[WS] connect_error:", message, err);
      }

      if (isAuthLikeErrorMessage(message)) {
        hardDisconnect(socket);
        socketRef.current = null;

        maybeDispatchAuthExpired({
          message,
          code: err?.code || null,
          status: err?.data?.status || null,
        });
      }
    };

    const handleAuthErrorEvent = (payload) => {
      if (import.meta.env.DEV) {
        console.warn("[WS] auth_error recibido:", payload);
      }

      hardDisconnect(socket);
      socketRef.current = null;

      const message =
        payload?.message || "Error de autenticación en WebSocket";

      maybeDispatchAuthExpired({
        message,
        code: payload?.code || "AUTH_ERROR",
        status: payload?.status || null,
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("auth_error", handleAuthErrorEvent);

    socketRef.current = socket;

    return () => {
      hardDisconnect(socket);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setConnected(false);
    };
  }, [
    normalizedToken,
    socketUrl,
    options.reconnectionAttempts,
    options.reconnectionDelay,
    disconnect,
    hardDisconnect,
  ]);

  const on = useCallback((event, callback) => {
    const socket = socketRef.current;

    if (!socket) return;
    if (typeof event !== "string" || !event.trim()) return;
    if (typeof callback !== "function") return;

    if (!listenersRef.current || typeof listenersRef.current !== "object") {
      listenersRef.current = {};
    }

    const eventName = event.trim();

    if (!(listenersRef.current[eventName] instanceof Set)) {
      listenersRef.current[eventName] = new Set();
    }

    const eventSet = listenersRef.current[eventName];
    if (eventSet.has(callback)) return;

    eventSet.add(callback);
    socket.on(eventName, callback);
  }, []);

  const off = useCallback((event, callback) => {
    const socket = socketRef.current;

    if (!socket) return;
    if (typeof event !== "string" || !event.trim()) return;
    if (typeof callback !== "function") return;

    const eventName = event.trim();

    try {
      socket.off(eventName, callback);
    } catch (_) {}

    const eventSet = listenersRef.current?.[eventName];
    if (eventSet instanceof Set) {
      eventSet.delete(callback);
      if (eventSet.size === 0) {
        delete listenersRef.current[eventName];
      }
    }
  }, []);

  const emit = useCallback((event, payload) => {
    const socket = socketRef.current;

    if (!socket) return;
    if (typeof event !== "string" || !event.trim()) return;

    try {
      socket.emit(event.trim(), payload);
    } catch (err) {
      console.error("[WS] emit error:", err);
    }
  }, []);

  return {
    connected,
    on,
    off,
    emit,
    disconnect,
    socket: socketRef.current,
  };
}