// src/views/VerificationView.jsx
import React, { useState, useEffect } from "react";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";

export function VerificationView({ API_URL }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Prellenar el código si viene en la URL ?code=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");
      if (urlCode) {
        setCode(urlCode);
      }
    } catch {
      // ignore
    }
  }, []);

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
      const cleanCode = code.trim();
      const res = await fetch(
        `${API_URL}/api/public/verificar/${encodeURIComponent(cleanCode)}`
      );

      if (!res.ok) {
        let message = "No se pudo verificar el documento.";
        if (res.status === 404) {
          message = "Código de verificación no válido o inexistente.";
        } else if (res.status === 410) {
          message =
            "El código de verificación ha expirado, solicita uno nuevo al emisor.";
        }
        let data;
        try {
          data = await res.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      const data = await res.json();

      if (!data.document) {
        throw new Error(
          "No se encontraron datos del documento asociados a este código."
        );
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Error al verificar el documento.");
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

  const doc = result?.document || null;
  const signers = Array.isArray(result?.signers) ? result.signers : [];
  const events = Array.isArray(result?.events) ? result.events : [];

  // Último evento de rechazo público (si existe)
  let lastRejectEvent = null;
  if (events.length > 0) {
    const rejects = events.filter(
      (ev) =>
        ev.event_type === "RECHAZO_PUBLICO" ||
        ev.descripcion === "RECHAZO_PUBLICO"
    );
    if (rejects.length > 0) {
      lastRejectEvent = rejects[rejects.length - 1];
    }
  }

  let rejectReason = "";
  if (lastRejectEvent && lastRejectEvent.metadata) {
    try {
      const meta =
        typeof lastRejectEvent.metadata === "string"
          ? JSON.parse(lastRejectEvent.metadata)
          : lastRejectEvent.metadata;
      if (meta && meta.motivo) {
        rejectReason = meta.motivo;
      }
    } catch {
      // metadata no JSON o corrupta, ignorar
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 32,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        background: "#0f172a0d",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          background: "#ffffff",
          borderRadius: 16,
          padding: 24,
          boxShadow:
            "0 18px 45px -24px rgba(15,23,42,0.45), 0 0 0 1px rgba(148,163,184,0.15)",
        }}
      >
        <PublicHeader />

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
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Ej: VF-4F8C-92D1-AB12"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              flex: 1,
              minWidth: 220,
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
              minWidth: 190,
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
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        {loading && !result && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: "0.9rem",
            }}
          >
            Verificando el código… Esto puede tardar unos segundos.
          </div>
        )}

        {result && doc && (
          <div
            style={{
              marginTop: 8,
              padding: 20,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            {/* Banner de rechazo si aplica */}
            {doc.status === "RECHAZADO" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#7f1d1d",
                  fontSize: "0.9rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: rejectReason ? 4 : 0,
                  }}
                >
                  Documento rechazado.
                </div>
                {rejectReason && (
                  <div>
                    Motivo: <strong>{rejectReason}</strong>
                  </div>
                )}
                {lastRejectEvent?.created_at && (
                  <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                    Fecha de rechazo:{" "}
                    {new Date(
                      lastRejectEvent.created_at
                    ).toLocaleString("es-CL")}
                  </div>
                )}
              </div>
            )}

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
                  {doc.title || doc.nombre || "Sin título"}
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
                      doc.status === "FIRMADO"
                        ? "#16a34a"
                        : doc.status === "RECHAZADO"
                        ? "#b91c1c"
                        : "#0369a1",
                  }}
                >
                  {statusLabel(doc.status)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Tipo de trámite
                </div>
                <div>
                  {doc.tipo_tramite_label ||
                    doc.tipo_tramite ||
                    "No informado"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Fecha de creación
                </div>
                <div>
                  {doc.created_at
                    ? new Date(doc.created_at).toLocaleString("es-CL")
                    : "No disponible"}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Firmantes
                </div>
                {signers.length > 0 ? (
                  <ul
                    style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      color: "#0f172a",
                    }}
                  >
                    {signers.map((s) => (
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

              {events.length > 0 && (
                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    Historial de eventos
                  </div>
                  <ul
                    style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      color: "#0f172a",
                    }}
                  >
                    {events.map((ev, idx) => (
                      <li key={idx}>
                        [
                        {new Date(ev.created_at).toLocaleString("es-CL")}
                        ] {ev.descripcion || ev.event_type}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {doc.pdf_final_url && (
              <div style={{ marginTop: 18 }}>
                <a
                  href={doc.pdf_final_url}
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

        <PublicFooter />
      </div>
    </div>
  );
}
