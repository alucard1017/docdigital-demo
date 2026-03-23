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

  const inputStyle = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    padding: "9px 14px",
    fontSize: "0.9rem",
    outline: "none",
    background:
      "linear-gradient(145deg,#020617,#020617 40%,#020617 100%)",
    color: "#e5e7eb",
    transition:
      "border-color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease",
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = "#4f46e5";
    e.target.style.boxShadow =
      "0 0 0 1px rgba(79,70,229,0.7),0 10px 25px rgba(15,23,42,0.85)";
  };

  const handleBlur = (e) => {
    e.target.style.borderColor = "rgba(148,163,184,0.7)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        {/* Marca */}
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
                width: 34,
                height: 34,
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 45%, #22c55e 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 800,
                fontSize: 17,
                boxShadow: "0 10px 25px rgba(37,99,235,0.6)",
              }}
            >
              V
            </div>
            <span
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#e5e7eb",
              }}
            >
              VeriFirma
            </span>
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#f9fafb",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Recuperar contraseña
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#9ca3af",
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
              border: "1px solid rgba(248,113,113,0.7)",
              background: "rgba(127,29,29,0.4)",
              color: "#fecaca",
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
              border: "1px solid rgba(52,211,153,0.7)",
              background: "rgba(6,95,70,0.35)",
              color: "#bbf7d0",
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
                color: "#e5e7eb",
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
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-main btn-primary"
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
              boxShadow: "0 14px 35px rgba(37,99,235,0.7)",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? "Enviando enlace..."
              : "Enviar enlace de recuperación"}
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
              color: "#a5b4fc",
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
