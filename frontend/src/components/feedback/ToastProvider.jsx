import { createContext, useCallback, useMemo, useState } from "react";

export const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = "info", title = "", message = "", duration = 3500 }) => {
      const id = ++toastId;

      setToasts((prev) => [
        ...prev,
        { id, type, title, message, duration },
      ]);

      if (duration > 0) {
        window.setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const value = useMemo(() => {
    return {
      addToast,
      removeToast,
    };
  }, [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div style={toastStackStyle}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              ...toastStyle,
              ...toastTypeStyles[toast.type],
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
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
  maxWidth: 380,
};

const toastStyle = {
  borderRadius: 14,
  padding: "14px 16px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  color: "#fff",
  minWidth: 280,
  backdropFilter: "blur(8px)",
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
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: "1.1rem",
  lineHeight: 1,
  opacity: 0.8,
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