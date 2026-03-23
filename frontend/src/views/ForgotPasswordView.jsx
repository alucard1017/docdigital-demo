// src/views/ForgotPasswordView.jsx
import React, { useState } from "react";
import api from "../api/client";

const ForgotPasswordView = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setMessage(
        "Si el correo existe en nuestro sistema, te enviaremos un enlace para restablecer tu contraseña en los próximos minutos."
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No pudimos procesar tu solicitud. Intenta nuevamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #e0f2fe 0, transparent 40%), radial-gradient(circle at bottom right, #e5e7eb 0, transparent 40%), #f8fafc",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "#ffffff",
          borderRadius: 24,
          padding: "32px 28px",
          boxShadow:
            "0 24px 80px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.25)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 50%, #22c55e 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              V
            </div>
            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#1f2933",
              }}
            >
              VeriFirma
            </span>
          </div>

          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#0f172a",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Recuperar contraseña
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Ingresa tu correo electrónico y te enviaremos un enlace seguro para
            restablecer tu acceso.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(254,242,242,0.9)",
              color: "#b91c1c",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "rgba(240,253,250,0.9)",
              color: "#047857",
              fontSize: "0.85rem",
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: 6,
                color: "#4b5563",
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "9px 11px",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#4f46e5";
                e.target.style.boxShadow =
                  "0 0 0 1px rgba(79,70,229,0.35),0 10px 25px rgba(15,23,42,0.06)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d5db";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 6,
              width: "100%",
              borderRadius: 999,
              border: "none",
              padding: "10px 14px",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "white",
              background:
                "linear-gradient(135deg,#4f46e5 0%,#6366f1 40%,#0ea5e9 100%)",
              boxShadow: "0 14px 35px rgba(37,99,235,0.28)",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
              transition: "transform 0.1s, box-shadow 0.1s, opacity 0.1s",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(1px)";
              e.currentTarget.style.boxShadow =
                "0 6px 18px rgba(37,99,235,0.35)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 14px 35px rgba(37,99,235,0.28)";
            }}
          >
            {submitting ? "Enviando enlace..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <a
            href="/"
            style={{
              fontSize: "0.8rem",
              color: "#4f46e5",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordView;
