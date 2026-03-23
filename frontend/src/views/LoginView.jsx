// src/views/LoginView.jsx
import React from "react";

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
}) {
  const handleGoToRegister = () => {
    window.location.href = "/register";
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
            Accede a tu cuenta
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Inicia sesión para enviar, firmar y administrar tus documentos
            electrónicos en un solo lugar.
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
                ? "1px solid rgba(239,68,68,0.35)"
                : "1px solid rgba(16,185,129,0.35)",
              background: message.includes("❌")
                ? "rgba(254,242,242,0.9)"
                : "rgba(240,253,250,0.9)",
              color: message.includes("❌") ? "#b91c1c" : "#047857",
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
          style={{ display: "grid", gap: 16 }}
        >
          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.8rem",
                display: "block",
                marginBottom: 6,
                color: "#4b5563",
              }}
            >
              RUN / correo electrónico
            </label>
            <input
              className="input-field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ingresa tu RUT o correo"
              required
              autoFocus
              autoComplete="username"
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

          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.8rem",
                display: "block",
                marginBottom: 6,
                color: "#4b5563",
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
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "9px 80px 9px 11px",
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#2563eb",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "4px 8px",
                  borderRadius: 999,
                }}
              >
                {showPassword ? "OCULTAR" : "VER"}
              </button>
            </div>
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
              boxShadow: "0 14px 35px rgba(37,99,235,0.28)",
              cursor: isLoggingIn ? "default" : "pointer",
              opacity: isLoggingIn ? 0.7 : 1,
              transition: "transform 0.1s, box-shadow 0.1s, opacity 0.1s",
            }}
            disabled={isLoggingIn}
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
            {isLoggingIn ? "Conectando…" : "Acceder al portal"}
          </button>
        </form>

        {/* Links secundarios */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8rem",
          }}
        >
          <button
            type="button"
            onClick={() => (window.location.href = "/forgot-password")}
            style={{
              background: "none",
              border: "none",
              color: "#4f46e5",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>

          <button
            type="button"
            onClick={handleGoToRegister}
            style={{
              background: "none",
              border: "none",
              color: "#4f46e5",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}
          >
            Crear cuenta nueva
          </button>
        </div>

        <button
          type="button"
          style={{
            width: "100%",
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => setShowHelp(!showHelp)}
        >
          ¿Problemas con ClaveÚnica?
        </button>

        {showHelp && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#f1f5f9",
              color: "#475569",
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
      </div>
    </div>
  );
}
