// src/components/feedback/ConfirmDialog.jsx
import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open,
  title = "Confirmar acción",
  message = "¿Estás seguro de continuar?",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        onCancel?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmButtonStyle =
    confirmVariant === "danger"
      ? {
          background: "#dc2626",
          color: "#fff",
          border: "1px solid #b91c1c",
        }
      : {
          background: "#2563eb",
          color: "#fff",
          border: "1px solid #1d4ed8",
        };

  return (
    <div
      role="presentation"
      onClick={() => {
        if (!loading) onCancel?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 18,
          background: "#0f172a",
          border: "1px solid #1f2937",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px 12px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h3
            id="confirm-dialog-title"
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "#e5e7eb",
            }}
          >
            {title}
          </h3>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <p
            id="confirm-dialog-message"
            style={{
              margin: 0,
              fontSize: "0.92rem",
              lineHeight: 1.6,
              color: "#cbd5e1",
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "0 20px 18px",
          }}
        >
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#111827",
              color: "#e5e7eb",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
              ...confirmButtonStyle,
            }}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}