// src/views/VerificationView.jsx
import React, { useState } from "react";

export function VerificationView({ API_URL }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Ingresa un código de verificación.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `${API_URL}/api/public/verificar/${encodeURIComponent(code.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudo verificar el documento.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status) => {
    if (!status) return "DESCONOCIDO";
    const map = {
      PENDIENTE: "Pendiente de firma",
      PENDIENTE_VISADO: "Pendiente de visado",
      PENDIENTE_FIRMA: "Pendiente de firma",
      VISADO: "Visado",
      FIRMADO: "Firmado",
      RECHAZADO: "Rechazado",
    };
    return map[status] || status;
  };

  return (
    <div
      style={{
        padding: 32,
        maxWidth: 900,
        margin: "0 auto",
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>
        Verificación pública de documento
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Ingresa el código de verificación que aparece en el PDF o en el correo
        de invitación para comprobar el estado actual del documento.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <input
          type="text"
          placeholder="Ej: VF-4F8C-92D1-AB12"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5f5",
            fontSize: "0.95rem",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Verificando..." : "Verificar documento"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 8,
            padding: 20,
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", marginBottom: 12 }}>
            Detalles del documento
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              fontSize: "0.9rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Título del documento
              </div>
              <div style={{ fontWeight: 600 }}>
                {result.document?.title || "Sin título"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Estado actual
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color:
                    result.document?.status === "FIRMADO"
                      ? "#16a34a"
                      : result.document?.status === "RECHAZADO"
                      ? "#b91c1c"
                      : "#0369a1",
                }}
              >
                {statusLabel(result.document?.status)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Tipo de trámite
              </div>
              <div>
                {result.document?.tipo_tramite_label ||
                  result.document?.tipo_tramite ||
                  "No informado"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Fecha de creación
              </div>
              <div>
                {result.document?.created_at
                  ? new Date(result.document.created_at).toLocaleString(
                      "es-CL"
                    )
                  : "No disponible"}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Firmantes
              </div>
              {Array.isArray(result.signers) && result.signers.length > 0 ? (
                <ul
                  style={{
                    marginTop: 6,
                    paddingLeft: 18,
                    color: "#0f172a",
                  }}
                >
                  {result.signers.map((s) => (
                    <li key={s.id || s.email}>
                      {s.name || s.email}{" "}
                      {s.signed_at
                        ? `✔️ firmó el ${new Date(
                            s.signed_at
                          ).toLocaleString("es-CL")}`
                        : "⏳ pendiente"}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "#6b7280" }}>
                  No hay firmantes registrados.
                </div>
              )}
            </div>

            {Array.isArray(result.events) && result.events.length > 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                <div
                  style={{ fontSize: "0.75rem", color: "#6b7280" }}
                >
                  Historial de eventos
                </div>
                <ul
                  style={{
                    marginTop: 6,
                    paddingLeft: 18,
                    color: "#0f172a",
                  }}
                >
                  {result.events.map((ev, idx) => (
                    <li key={idx}>
                      [{new Date(ev.created_at).toLocaleString("es-CL")}]{" "}
                      {ev.descripcion || ev.event_type}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {result.document?.pdf_final_url && (
            <div style={{ marginTop: 18 }}>
              <a
                href={result.document.pdf_final_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "#0f172a",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                📄 Abrir PDF final firmado
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
