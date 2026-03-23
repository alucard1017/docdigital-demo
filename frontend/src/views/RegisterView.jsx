// src/views/RegisterView.jsx
import React, { useState } from "react";
import api from "../api/client";

const RegisterView = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/public/register", {
        name,
        email,
        rut,
        password,
      });

      setMessage(
        res.data?.message ||
          "Tu cuenta fue creada correctamente. Revisa tu correo para activar el acceso."
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No pudimos crear tu cuenta. Intenta nuevamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "9px 11px",
    fontSize: "0.9rem",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
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
          maxWidth: 480,
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
            Crear cuenta en VeriFirma
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Regístrate para comenzar a enviar y firmar documentos electrónicos
            con trazabilidad completa.
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
              Nombre completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              style={inputStyle}
            />
          </div>

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
              style={inputStyle}
            />
          </div>

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
              RUT / RUN
            </label>
            <input
              type="text"
              required
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="11.111.111-1"
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            }}
          >
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
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
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
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
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
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
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
            {loading ? "Creando cuenta..." : "Crear cuenta"}
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

export default RegisterView;
