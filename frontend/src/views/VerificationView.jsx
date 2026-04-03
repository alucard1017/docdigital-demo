import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";

function normalizeApiBase(API_URL) {
  const baseFromProp = API_URL || import.meta.env.VITE_API_URL || "";
  let trimmed = String(baseFromProp).trim().replace(/\/+$/, "");
  trimmed = trimmed.replace(/\/api\/api$/, "/api");
  if (!trimmed) return "";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getStatusLabel(status) {
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
}

function parseMetadata(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getRejectInfo(events = []) {
  const rejects = events.filter(
    (ev) =>
      ev?.event_type === "REJECTED" ||
      ev?.event_type === "RECHAZO_PUBLICO" ||
      ev?.descripcion === "RECHAZO_PUBLICO"
  );

  if (rejects.length === 0) {
    return { lastRejectEvent: null, rejectReason: "" };
  }

  const lastRejectEvent = rejects[rejects.length - 1];
  const meta = parseMetadata(lastRejectEvent?.metadata);

  return {
    lastRejectEvent,
    rejectReason:
      meta?.motivo || meta?.reason || lastRejectEvent?.reject_reason || "",
  };
}

export function VerificationView({ API_URL }) {
  const API_BASE = useMemo(() => normalizeApiBase(API_URL), [API_URL]);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const verifyCode = useCallback(
    async (rawCode) => {
      const cleanCode = String(rawCode || "").trim();

      if (!cleanCode) {
        setError("Ingresa un código de verificación.");
        setResult(null);
        return;
      }

      if (!API_BASE) {
        setError("La URL del servicio de verificación no está configurada.");
        setResult(null);
        return;
      }

      setLoading(true);
      setError("");
      setResult(null);

      try {
        const url = `${API_BASE}/public/verificar/${encodeURIComponent(
          cleanCode
        )}`;

        const res = await fetch(url);

        if (!res.ok) {
          let message = "No se pudo verificar el documento.";

          if (res.status === 404) {
            message = "Código de verificación no válido o inexistente.";
          } else if (res.status === 410) {
            message =
              "El código de verificación ha expirado, solicita uno nuevo al emisor.";
          }

          try {
            const data = await res.json();
            if (data?.message) message = data.message;
          } catch {
            // noop
          }

          throw new Error(message);
        }

        const data = await res.json();

        if (!data?.document) {
          throw new Error(
            "No se encontraron datos del documento asociados a este código."
          );
        }

        setResult(data);
      } catch (err) {
        console.error("Error al verificar documento:", err);
        setError(err?.message || "Error al verificar el documento.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");

      if (urlCode) {
        setCode(urlCode);
        verifyCode(urlCode);
      }
    } catch {
      // noop
    }
  }, [verifyCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await verifyCode(code);
  };

  const doc = result?.document || null;
  const signers = Array.isArray(result?.signers) ? result.signers : [];
  const events = Array.isArray(result?.events) ? result.events : [];

  const { lastRejectEvent, rejectReason } = useMemo(
    () => getRejectInfo(events),
    [events]
  );

  const pdfToShow =
    doc?.pdf_final_url || doc?.pdf_url || result?.pdfUrl || null;

  const bgOuter = "#020617";
  const bgCard =
    "radial-gradient(circle at top left, rgba(37,99,235,0.18), #020617 55%, #020617 100%)";
  const borderCard = "#1f2937";
  const textMain = "#e5e7eb";
  const textSubtle = "#94a3b8";

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        background: bgOuter,
        color: textMain,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          borderRadius: 18,
          padding: 24,
          border: `1px solid ${borderCard}`,
          background: bgCard,
          boxShadow:
            "0 24px 70px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
        }}
      >
        <PublicHeader />

        <div style={{ marginTop: 8, marginBottom: 20 }}>
          <h1
            style={{
              fontSize: "clamp(1.35rem, 2vw, 1.7rem)",
              margin: 0,
              marginBottom: 6,
              color: "#f9fafb",
            }}
          >
            Verificación pública de documento
          </h1>

          <p
            style={{
              color: textSubtle,
              margin: 0,
              fontSize: "0.95rem",
              maxWidth: 620,
              lineHeight: 1.55,
            }}
          >
            Ingresa el código de verificación que aparece en el PDF o en el
            correo de invitación para comprobar el estado actual del documento.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 20,
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
              padding: "12px 14px",
              borderRadius: 999,
              border: "1px solid #1f2937",
              fontSize: "0.95rem",
              background: "#020617",
              color: textMain,
              boxShadow: "0 0 0 1px rgba(15,23,42,0.8)",
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              border: "none",
              background: loading
                ? "rgba(37,99,235,0.6)"
                : "linear-gradient(135deg,#2563eb,#4f46e5)",
              color: "#f9fafb",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              minWidth: 190,
              fontSize: "0.9rem",
              boxShadow: "0 14px 30px rgba(37,99,235,0.45)",
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
              borderRadius: 12,
              background:
                "linear-gradient(135deg,rgba(185,28,28,0.16),rgba(15,23,42,0.95))",
              color: "#fecaca",
              fontSize: "0.9rem",
              border: "1px solid #7f1d1d",
            }}
          >
            {error}
          </div>
        )}

        {loading && !result && (
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background:
                "linear-gradient(135deg,rgba(37,99,235,0.14),rgba(15,23,42,0.95))",
              color: "#bfdbfe",
              fontSize: "0.9rem",
              border: "1px solid #1d4ed8",
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
              border: "1px solid #1f2937",
              background:
                "radial-gradient(circle at top left, rgba(15,23,42,1), rgba(15,23,42,0.96))",
            }}
          >
            {doc.status === "RECHAZADO" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg,rgba(248,113,113,0.2),rgba(15,23,42,0.96))",
                  border: "1px solid #fecaca",
                  color: "#fecaca",
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
                    {new Date(lastRejectEvent.created_at).toLocaleString(
                      "es-CL"
                    )}
                  </div>
                )}
              </div>
            )}

            <h2
              style={{
                fontSize: "1.15rem",
                marginBottom: 14,
                color: "#e5e7eb",
              }}
            >
              Detalles del documento
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
                fontSize: "0.9rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                  Título del documento
                </div>
                <div style={{ fontWeight: 600, color: "#f9fafb" }}>
                  {doc.title || doc.nombre || "Sin título"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                  Estado actual
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color:
                      doc.status === "FIRMADO"
                        ? "#4ade80"
                        : doc.status === "RECHAZADO"
                        ? "#f97373"
                        : "#38bdf8",
                  }}
                >
                  {getStatusLabel(doc.status)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                  Tipo de trámite
                </div>
                <div>
                  {doc.tipo_tramite_label ||
                    doc.tipo_tramite ||
                    "No informado"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                  Fecha de creación
                </div>
                <div>
                  {doc.created_at
                    ? new Date(doc.created_at).toLocaleString("es-CL")
                    : "No disponible"}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                  Firmantes
                </div>

                {signers.length > 0 ? (
                  <ul
                    style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      color: "#e5e7eb",
                      lineHeight: 1.6,
                    }}
                  >
                    {signers.map((s) => (
                      <li key={s.id || s.email}>
                        {s.name || s.email || "Firmante"}{" "}
                        {s.signed_at
                          ? `✔ firmó el ${new Date(s.signed_at).toLocaleString(
                              "es-CL"
                            )}`
                          : s.status === "RECHAZADO"
                          ? "✗ rechazó el documento"
                          : "⏳ pendiente"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: textSubtle }}>
                    No hay firmantes registrados.
                  </div>
                )}
              </div>

              {events.length > 0 && (
                <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                  <div style={{ fontSize: "0.75rem", color: textSubtle }}>
                    Historial de eventos
                  </div>

                  <ul
                    style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      color: "#e5e7eb",
                      lineHeight: 1.6,
                    }}
                  >
                    {events.map((ev, idx) => (
                      <li key={ev.id || idx}>
                        [{new Date(ev.created_at).toLocaleString("es-CL")}]{" "}
                        {ev.descripcion || ev.event_type || "Evento"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {pdfToShow && (
              <div style={{ marginTop: 18 }}>
                <a
                  href={pdfToShow}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background:
                      "linear-gradient(135deg,#f97316,#ea580c,#b91c1c)",
                    color: "#fef2f2",
                    fontSize: "0.9rem",
                    textDecoration: "none",
                    boxShadow: "0 12px 28px rgba(248,113,113,0.45)",
                  }}
                >
                  📄 Abrir PDF
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}