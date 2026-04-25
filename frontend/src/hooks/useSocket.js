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

  return /jwt expired|unauthorized|authentication|invalid token|token inválido|token invalido|no autorizado|usuario no válido|usuario no valido|forbidden|403|401/i.test(
    message
  );
}

function getFriendlySocketError(message) {
  const text = String(message || "").toLowerCase();

  if (!text) {
    return "No se pudo conectar en este momento. Intenta nuevamente.";
  }

  if (
    text.includes("timeout") ||
    text.includes("network") ||
    text.includes("xhr poll error") ||
    text.includes("websocket error") ||
    text.includes("transport error")
  ) {
    return "Se perdió la conexión con el servidor. Estamos intentando reconectar.";
  }

  if (text.includes("server error") || text.includes("internal")) {
    return "El servidor no respondió correctamente. Intenta nuevamente en unos segundos.";
  }

  return "No se pudo conectar en este momento. Intenta nuevamente.";
}

export const SOCKET_STATUS = {
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DISCONNECTED: "disconnected",
  ERROR: "error",
};

export function useSocket(accessToken, options = {}) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});
  const authExpiredHandledRef = useRef(false);

  const [status, setStatus] = useState(SOCKET_STATUS.IDLE);
  const [lastError, setLastError] = useState(null);
  const [canRetry, setCanRetry] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [errorReason, setErrorReason] = useState(null);

  const socketUrl = useMemo(() => buildSocketUrl(), []);
  const normalizedToken =
    typeof accessToken === "string" ? accessToken.trim() : "";

  const clearCustomListeners = useCallback((socketInstance) => {
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

  const detachInternalListeners = useCallback((socketInstance) => {
    if (!socketInstance) return;

    try {
      socketInstance.off("connect");
      socketInstance.off("disconnect");
      socketInstance.off("connect_error");
      socketInstance.off("error");
      socketInstance.off("auth_error");
      socketInstance.off("reconnect_attempt");
      socketInstance.off("reconnect");
      socketInstance.off("reconnect_failed");
    } catch (_) {}
  }, []);

  const hardDisconnect = useCallback(
    (socketInstance) => {
      if (!socketInstance) return;

      clearCustomListeners(socketInstance);
      detachInternalListeners(socketInstance);

      try {
        socketInstance.removeAllListeners?.();
      } catch (_) {}

      try {
        socketInstance.disconnect();
      } catch (_) {}
    },
    [clearCustomListeners, detachInternalListeners]
  );

  const resetUiState = useCallback(() => {
    setLastError(null);
    setErrorReason(null);
    setCanRetry(false);
    setReconnectAttempt(0);
  }, []);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    hardDisconnect(socket);
    socketRef.current = null;

    setStatus(SOCKET_STATUS.DISCONNECTED);
    resetUiState();
  }, [hardDisconnect, resetUiState]);

  useEffect(() => {
    // Cada vez que cambia el token, reseteamos auth y errores
    authExpiredHandledRef.current = false;
    resetUiState();

    if (!isBrowser()) return;

    // Si no hay token, no intentamos conectar
    if (!normalizedToken) {
      disconnect();
      return;
    }

    // Si ya había socket, lo cerramos limpio antes de crear uno nuevo
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

    socketRef.current = socket;
    setStatus(SOCKET_STATUS.CONNECTING);
    setCanRetry(false);
    setLastError(null);
    setErrorReason(null);
    setReconnectAttempt(0);

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

    const handleConnect = () => {
      setStatus(SOCKET_STATUS.CONNECTED);
      setLastError(null);
      setErrorReason(null);
      setCanRetry(false);
      setReconnectAttempt(0);
      authExpiredHandledRef.current = false;

      if (import.meta.env.DEV) {
        console.log("[WS] conectado");
      }
    };

    const handleDisconnect = (reason) => {
      if (import.meta.env.DEV) {
        console.warn("[WS] desconectado:", reason);
      }

      const isIntentionalClose =
        reason === "io client disconnect" ||
        reason === "client namespace disconnect";

      if (isIntentionalClose) {
        setStatus(SOCKET_STATUS.DISCONNECTED);
        setLastError(null);
        setErrorReason("client_disconnect");
        setCanRetry(false);
        return;
      }

      // Desconexión inesperada: dejamos opción de reintento manual
      setStatus(SOCKET_STATUS.DISCONNECTED);
      setLastError("Conexión perdida con el servidor.");
      setErrorReason(reason || "server_disconnect");
      setCanRetry(true);
    };

    const handleReconnectAttempt = (attemptNumber) => {
      setStatus(SOCKET_STATUS.RECONNECTING);
      setLastError("Reconectando con el servidor…");
      setErrorReason("reconnecting");
      setCanRetry(true);
      setReconnectAttempt(attemptNumber);

      if (import.meta.env.DEV) {
        console.log("[WS] reconnect_attempt:", attemptNumber);
      }
    };

    const handleReconnect = (attemptNumber) => {
      setStatus(SOCKET_STATUS.CONNECTED);
      setLastError(null);
      setErrorReason(null);
      setCanRetry(false);
      setReconnectAttempt(0);

      if (import.meta.env.DEV) {
        console.log("[WS] reconnect success:", attemptNumber);
      }
    };

    const handleReconnectFailed = () => {
      setStatus(SOCKET_STATUS.ERROR);
      setLastError(
        "No se pudo restablecer la conexión. Puedes reintentar manualmente."
      );
      setErrorReason("reconnect_failed");
      setCanRetry(true);

      if (import.meta.env.DEV) {
        console.warn("[WS] reconnect_failed");
      }
    };

    const handleConnectError = (err) => {
      const rawMessage =
        err?.message ||
        err?.data?.message ||
        "Error de conexión con el servidor.";

      if (import.meta.env.DEV) {
        console.error("[WS] connect_error:", rawMessage, err);
      }

      if (isAuthLikeErrorMessage(rawMessage)) {
        // Error de autenticación: desconectamos y avisamos a la app
        setStatus(SOCKET_STATUS.ERROR);
        setLastError("Tu sesión expiró. Debes iniciar sesión nuevamente.");
        setErrorReason("auth_error");
        setCanRetry(false);

        hardDisconnect(socket);
        socketRef.current = null;

        maybeDispatchAuthExpired({
          message: rawMessage,
          code: err?.code || null,
          status: err?.data?.status || null,
        });
        return;
      }

      setStatus(SOCKET_STATUS.ERROR);
      setLastError(getFriendlySocketError(rawMessage));
      setErrorReason("connect_error");
      setCanRetry(true);
    };

    const handleAuthErrorEvent = (payload) => {
      if (import.meta.env.DEV) {
        console.warn("[WS] auth_error recibido:", payload);
      }

      const message =
        payload?.message || "Error de autenticación en WebSocket.";

      setStatus(SOCKET_STATUS.ERROR);
      setLastError("Tu sesión expiró. Debes iniciar sesión nuevamente.");
      setErrorReason("auth_error_event");
      setCanRetry(false);

      hardDisconnect(socket);
      socketRef.current = null;

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
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_failed", handleReconnectFailed);

    return () => {
      hardDisconnect(socket);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setStatus(SOCKET_STATUS.DISCONNECTED);
      resetUiState();
    };
  }, [
    normalizedToken,
    socketUrl,
    options.reconnectionAttempts,
    options.reconnectionDelay,
    disconnect,
    hardDisconnect,
    resetUiState,
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

  const retry = useCallback(() => {
    const socket = socketRef.current;

    if (!socket) return;

    try {
      setStatus(SOCKET_STATUS.CONNECTING);
      setLastError(null);
      setErrorReason("manual_retry");
      setCanRetry(false);
      socket.connect();
    } catch (err) {
      console.error("[WS] retry error:", err);
      setStatus(SOCKET_STATUS.ERROR);
      setLastError("No se pudo reintentar la conexión.");
      setErrorReason("retry_error");
      setCanRetry(true);
    }
  }, []);

  const connected = status === SOCKET_STATUS.CONNECTED;
  const reconnecting = status === SOCKET_STATUS.RECONNECTING;
  const hasError = status === SOCKET_STATUS.ERROR;

  return {
    status,
    connected,
    reconnecting,
    hasError,
    lastError,
    errorReason,
    reconnectAttempt,
    canRetry,
    on,
    off,
    emit,
    disconnect,
    retry,
    socket: socketRef.current,
  };
}