// src/views/LoginView.jsx
import React, { useState } from "react";

export function LoginView({
  identifier,
  setIdentifier,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  showHelp,
  setShowHelp,
  message,
  isLoggingIn,
  handleLogin,
  rememberMe,
  setRememberMe,
}) {
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const handleGoToRegister = () => {
    window.location.href = "/register";
  };

  return (
    <>
      <div className="auth-bg">
        <div className="auth-card">
          {/* Marca */}
          <div style={{ marginBottom: 22 }}>
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
              Accede a tu cuenta
            </h1>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#9ca3af",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Envía, firma y gestiona tus documentos electrónicos en un entorno
              seguro y centralizado.
            </p>
          </div>

          {/* Mensajes */}
          {message && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 10px",
                borderRadius: 10,
                border: message.includes("❌")
                  ? "1px solid rgba(248,113,113,0.7)"
                  : "1px solid rgba(52,211,153,0.7)",
                background: message.includes("❌")
                  ? "rgba(127,29,29,0.4)"
                  : "rgba(6,95,70,0.35)",
                color: message.includes("❌") ? "#fecaca" : "#bbf7d0",
                fontSize: "0.85rem",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          {/* Formulario */}
          <form
            onSubmit={handleLogin}
            autoComplete="on"
            style={{ display: "grid", gap: 14 }}
          >
            <div>
              <label
                style={{
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: 6,
                  color: "#e5e7eb",
                }}
              >
                RUN / correo electrónico
              </label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ingresa tu RUT o correo"
                required
                autoFocus
                autoComplete="username"
                style={{
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
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#4f46e5";
                  e.target.style.boxShadow =
                    "0 0 0 1px rgba(79,70,229,0.7),0 10px 25px rgba(15,23,42,0.85)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(148,163,184,0.7)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: 6,
                  color: "#e5e7eb",
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.7)",
                    padding: "9px 90px 9px 14px",
                    fontSize: "0.9rem",
                    outline: "none",
                    background:
                      "linear-gradient(145deg,#020617,#020617 40%,#020617 100%)",
                    color: "#e5e7eb",
                    transition:
                      "border-color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#4f46e5";
                    e.target.style.boxShadow =
                      "0 0 0 1px rgba(79,70,229,0.7),0 10px 25px rgba(15,23,42,0.85)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(148,163,184,0.7)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background:
                      "linear-gradient(135deg, #020617, #1d4ed8 90%)",
                    border: "1px solid rgba(129,140,248,0.85)",
                    color: "#e5e7eb",
                    fontSize: 10,
                    cursor: "pointer",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: 999,
                    letterSpacing: "0.08em",
                  }}
                >
                  {showPassword ? "OCULTAR" : "VER"}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4,
                marginBottom: 2,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.8rem",
                  color: "#d1d5db",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    border: "1px solid rgba(148,163,184,0.9)",
                    accentColor: "#4f46e5",
                    cursor: "pointer",
                  }}
                />
                Mantener sesión iniciada en este equipo
              </label>

              <button
                type="button"
                onClick={() => (window.location.href = "/forgot-password")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#a5b4fc",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                  fontSize: "0.8rem",
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              className="btn-main btn-primary"
              style={{
                width: "100%",
                fontSize: "0.95rem",
                fontWeight: 600,
                borderRadius: 999,
                border: "none",
                padding: "10px 14px",
                color: "white",
                background:
                  "linear-gradient(135deg,#4f46e5 0%,#6366f1 40%,#0ea5e9 100%)",
                boxShadow: "0 16px 38px rgba(37,99,235,0.7)",
                cursor: isLoggingIn ? "default" : "pointer",
                opacity: isLoggingIn ? 0.72 : 1,
              }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Conectando…" : "Acceder al portal"}
            </button>
          </form>

          {/* Links secundarios + seguridad */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            <button
              type="button"
              onClick={handleGoToRegister}
              style={{
                background: "none",
                border: "none",
                color: "#c4b5fd",
                cursor: "pointer",
                fontWeight: 600,
                padding: 0,
              }}
            >
              Crear cuenta nueva
            </button>

            <span style={{ opacity: 0.9 }}>
              ¿Problemas de acceso?{" "}
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#93c5fd",
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                }}
                onClick={() => setShowHelp(!showHelp)}
              >
                Ver ayuda
              </button>
            </span>
          </div>

          {showHelp && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(55,65,81,0.95)",
                color: "#e5e7eb",
                fontSize: "0.8rem",
              }}
            >
              <strong>Recuperación de acceso:</strong>
              <br />
              Si utilizas ClaveÚnica, recupérala en{" "}
              <strong>claveunica.gob.cl</strong>. Para cuentas administrativas,
              contacta al soporte técnico de tu organización.
            </div>
          )}

          {/* Microcopy + link a modal */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.76rem",
              color: "#94a3b8",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
              }}
            >
              🔒
            </span>
            <span>
              Tus credenciales se transmiten de forma cifrada y protegida
              mediante conexiones seguras.{" "}
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#bfdbfe",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  textDecoration: "underline",
                  padding: 0,
                  marginLeft: 4,
                }}
              >
                ¿Cómo protegemos tus datos?
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* Modal de seguridad */}
      {showSecurityModal && (
        <div
          className="auth-modal-backdrop"
          onClick={() => setShowSecurityModal(false)}
        >
          <div
            className="auth-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-modal-header">
              <div className="auth-modal-title">Seguridad de tu cuenta</div>
              <button
                className="auth-modal-close"
                type="button"
                onClick={() => setShowSecurityModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="auth-modal-body">
              <p>
                Tus credenciales viajan siempre cifradas mediante HTTPS y nunca
                se almacenan en texto plano. Limitamos los intentos de acceso y
                registramos actividad sospechosa para proteger tu cuenta.
              </p>
              <p style={{ marginTop: 8 }}>
                Para mayor seguridad, utiliza una contraseña única y activa la
                verificación en dos pasos cuando esté disponible en VeriFirma.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
