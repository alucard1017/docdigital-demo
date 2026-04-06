import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const ToastContext = createContext(null);

let toastId = 0;

const MAX_TOASTS = 5;

const DEFAULT_DURATIONS = {
  success: 3200,
  error: 4500,
  warning: 4000,
  info: 3500,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timeoutId = timeoutsRef.current.get(id);

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();
    setToasts([]);
  }, []);

  const addToast = useCallback(
    ({
      type = "info",
      title = "",
      message = "",
      duration,
    }) => {
      const id = ++toastId;
      const safeType = toastTypeStyles[type] ? type : "info";
      const safeDuration =
        typeof duration === "number"
          ? duration
          : DEFAULT_DURATIONS[safeType] ?? 3500;

      const nextToast = {
        id,
        type: safeType,
        title,
        message,
        duration: safeDuration,
      };

      setToasts((prev) => {
        const next = [...prev, nextToast];
        return next.slice(-MAX_TOASTS);
      });

      if (safeDuration > 0 && typeof window !== "undefined") {
        const timeoutId = window.setTimeout(() => {
          removeToast(id);
        }, safeDuration);

        timeoutsRef.current.set(id, timeoutId);
      }

      return id;
    },
    [removeToast]
  );

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  const value = useMemo(() => {
    return {
      addToast,
      removeToast,
      clearToasts,
    };
  }, [addToast, removeToast, clearToasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div style={toastStackStyle} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            style={{
              ...toastStyle,
              ...toastTypeStyles[toast.type],
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                {toast.title ? (
                  <div style={toastTitleStyle}>{toast.title}</div>
                ) : null}

                {toast.message ? (
                  <div style={toastMessageStyle}>{toast.message}</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={closeButtonStyle}
                aria-label="Cerrar notificación"
                title="Cerrar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toastStackStyle = {
  position: "fixed",
  top: 20,
  right: 20,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "min(380px, calc(100vw - 24px))",
  maxWidth: 380,
  pointerEvents: "none",
};

const toastStyle = {
  borderRadius: 14,
  padding: "14px 16px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  color: "#fff",
  minWidth: 280,
  maxWidth: "100%",
  backdropFilter: "blur(8px)",
  pointerEvents: "auto",
  border: "1px solid rgba(255,255,255,0.12)",
};

const toastTitleStyle = {
  fontWeight: 700,
  fontSize: "0.95rem",
  marginBottom: 4,
};

const toastMessageStyle = {
  fontSize: "0.88rem",
  lineHeight: 1.4,
  opacity: 0.95,
  wordBreak: "break-word",
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: "1.1rem",
  lineHeight: 1,
  opacity: 0.8,
  alignSelf: "flex-start",
  padding: 0,
};

const toastTypeStyles = {
  success: {
    background: "linear-gradient(135deg, #166534, #15803d)",
  },
  error: {
    background: "linear-gradient(135deg, #991b1b, #dc2626)",
  },
  warning: {
    background: "linear-gradient(135deg, #92400e, #d97706)",
  },
  info: {
    background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
  },
};