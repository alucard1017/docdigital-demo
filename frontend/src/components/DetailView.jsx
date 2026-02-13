// src/components/DetailView.jsx
import React, { useState, useEffect } from "react";
import { Timeline } from "./Timeline";
import { EventList } from "./EventList";
import { DetailActions } from "./DetailActions";
import { DOC_STATUS, API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

export function DetailView({
  selectedDoc,
  pdfUrl,
  puedeFirmar,
  puedeVisar,
  puedeRechazar,
  events,
  manejarAccionDocumento,
  setView,
  setSelectedDoc,
  logout,
  token,
}) {
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [signers, setSigners] = useState([]);
  const [loadingSigners, setLoadingSigners] = useState(false);
  const [reenviarLoadingVisado, setReenviarLoadingVisado] = useState(false);
  const [reenviarSignerId, setReenviarSignerId] = useState(null);
  const [recordatorioLoading, setRecordatorioLoading] = useState(false);

  useEffect(() => {
    if (!selectedDoc) return;

    const fetchTimeline = async () => {
      try {
        setLoadingTimeline(true);
        const res = await fetch(
          `${API_URL}/api/docs/${selectedDoc.id}/timeline`
        );
        const data = await res.json();

        if (res.ok && data && data.timeline) {
          setTimeline(data.timeline);
        } else {
          setTimeline(null);
        }
      } catch (err) {
        console.error("Error fetching timeline:", err);
        setTimeline(null);
      } finally {
        setLoadingTimeline(false);
      }
    };

    const fetchSigners = async () => {
      try {
        setLoadingSigners(true);
        const res = await fetch(
          `${API_URL}/api/docs/${selectedDoc.id}/signers`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          setSigners([]);
          return;
        }
        const data = await res.json();
        setSigners(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching signers:", err);
        setSigners([]);
      } finally {
        setLoadingSigners(false);
      }
    };

    fetchTimeline();
    fetchSigners();

    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [selectedDoc]);

  if (!selectedDoc) return null;

  const safeEvents = Array.isArray(events) ? events : [];

  const mostrarBotonReenvioVisado =
    selectedDoc.requires_visado === true &&
    selectedDoc.status === DOC_STATUS.PENDIENTE_VISADO &&
    selectedDoc.visador_email;

  const mostrarBotonRecordatorio =
    selectedDoc.status === DOC_STATUS.PENDIENTE_VISADO ||
    selectedDoc.status === DOC_STATUS.PENDIENTE_FIRMA;

  async function handleReenviarVisado() {
    if (!selectedDoc) return;
    try {
      setReenviarLoadingVisado(true);
      const res = await fetch(
        `${API_URL}/api/docs/${selectedDoc.id}/reenviar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "VISADO" }),
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "No se pudo reenviar el correo de visado"
        );
      }
      alert(data.message || "Recordatorio de visado reenviado");
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setReenviarLoadingVisado(false);
    }
  }

  async function handleReenviarFirma(signerId) {
    if (!selectedDoc || !signerId) return;
    try {
      setReenviarSignerId(signerId);
      const res = await fetch(
        `${API_URL}/api/docs/${selectedDoc.id}/reenviar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "FIRMA", signerId }),
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "No se pudo reenviar el correo de firma"
        );
      }
      alert(data.message || "Recordatorio de firma reenviado");
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setReenviarSignerId(null);
    }
  }

  async function handleEnviarRecordatorioATodos() {
    if (!selectedDoc) return;
    try {
      setRecordatorioLoading(true);
      const res = await fetch(
        `${API_URL}/api/docs/${selectedDoc.id}/recordatorio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No se pudo enviar el recordatorio");
      }
      alert(`✅ ${data.message}`);
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setRecordatorioLoading(false);
    }
  }

  const numeroInterno =
    (timeline &&
      timeline.document &&
      timeline.document.numero_contrato_interno) ||
    selectedDoc.numero_contrato_interno;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2>VeriFirma</h2>

        <div
          className="nav-item"
          onClick={() => {
            setView("list");
            setSelectedDoc(null);
          }}
        >
          <span>⬅️</span> Volver a la Bandeja
        </div>

        <div
          style={{ marginTop: "auto" }}
          className="nav-item"
          onClick={logout}
        >
          <span>🚪</span> Cerrar Sesión
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <span
            style={{
              color: "#64748b",
              fontWeight: 500,
              fontSize: "0.9rem",
            }}
          >
            Revisión de Documento{" "}
            {numeroInterno ? `(${numeroInterno})` : `#${selectedDoc.id}`} -
            Estado {selectedDoc.status}
          </span>
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Hola, <span style={{ color: "var(--primary)" }}>Alucard</span>
          </span>
        </header>

        <div className="content-body">
          <div className="card-premium">
            <h1
              style={{
                margin: 0,
                fontSize: "1.8rem",
                fontWeight: 800,
              }}
            >
              {selectedDoc.title}
            </h1>

            <p
              style={{
                color: "#64748b",
                marginBottom: 16,
                fontSize: "0.95rem",
              }}
            >
              N° interno:{" "}
              <strong>{numeroInterno || `#${selectedDoc.id}`}</strong> · Estado:{" "}
              <strong>{selectedDoc.status}</strong>
            </p>

            {selectedDoc.description && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 12,
                  borderRadius: 12,
                  background: "#f9fafb",
                  fontSize: "0.9rem",
                  color: "#4b5563",
                }}
              >
                <strong>Descripción:</strong> {selectedDoc.description}
              </div>
            )}

            {selectedDoc.status === DOC_STATUS.RECHAZADO &&
              selectedDoc.reject_reason && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: 12,
                    borderRadius: 12,
                    background: "#fef2f2",
                    fontSize: "0.9rem",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                  }}
                >
                  <strong>Motivo de rechazo:</strong>{" "}
                  {selectedDoc.reject_reason}
                </div>
              )}

            {/* Botones Ver / Descargar + Reenvío */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Visualización del documento original
              </span>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {mostrarBotonRecordatorio && (
                  <button
                    type="button"
                    className="btn-main"
                    onClick={handleEnviarRecordatorioATodos}
                    disabled={recordatorioLoading}
                    style={{
                      background: "#8b5cf6",
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: recordatorioLoading ? "not-allowed" : "pointer",
                      opacity: recordatorioLoading ? 0.6 : 1,
                    }}
                  >
                    {recordatorioLoading
                      ? "Enviando recordatorio..."
                      : "🔔 Enviar recordatorio"}
                  </button>
                )}

                {mostrarBotonReenvioVisado && (
                  <button
                    type="button"
                    className="btn-main"
                    onClick={handleReenviarVisado}
                    disabled={reenviarLoadingVisado}
                    style={{
                      background: "#fbbf24",
                      color: "#92400e",
                      fontSize: "0.8rem",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    {reenviarLoadingVisado
                      ? "Reenviando..."
                      : "Reenviar visado"}
                  </button>
                )}

                {selectedDoc && (
                  <a
                    href={`${API_URL}/api/docs/${selectedDoc.id}/download`}
                    className="btn-main"
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    📥 Descargar PDF
                  </a>
                )}

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-main"
                    style={{
                      background: "#e5e7eb",
                      color: "#111827",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    👁️ Ver PDF
                  </a>
                )}
              </div>
            </div>

            {/* Visor PDF */}
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                marginBottom: 20,
                minHeight: "60vh",
                background: "#111827",
              }}
            >
              {pdfUrl ? (
                <iframe
                  title="PDF del documento"
                  src={pdfUrl}
                  style={{
                    width: "100%",
                    height: "70vh",
                    border: "none",
                  }}
                />
              ) : (
                <div style={{ padding: 24, color: "#e5e7eb" }}>
                  No se encontró el archivo PDF para este documento.
                </div>
              )}
            </div>

            {/* Sección firmantes */}
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Firmantes
              </h3>

              {loadingSigners ? (
                <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                  Cargando firmantes...
                </p>
              ) : signers.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                  No hay firmantes registrados para este documento.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {signers.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                          {s.name || "Firmante"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748b",
                          }}
                        >
                          {s.email} · Estado: {s.status}
                        </div>
                      </div>

                      {s.status !== "FIRMADO" && (
                        <button
                          type="button"
                          className="btn-main"
                          onClick={() => handleReenviarFirma(s.id)}
                          disabled={reenviarSignerId === s.id}
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: "0.8rem",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          {reenviarSignerId === s.id
                            ? "Reenviando..."
                            : "Reenviar correo"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Timeline */}
            <div style={{ marginTop: 32, marginBottom: 32 }}>
              {loadingTimeline ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#94a3b8",
                  }}
                >
                  Cargando progreso...
                </div>
              ) : timeline ? (
                <Timeline timeline={timeline} />
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#94a3b8",
                  }}
                >
                  No hay datos de progreso disponibles
                </div>
              )}
            </div>

            {/* Historial de acciones */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid #e5e7eb",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Historial de acciones
              </h3>

              {timeline && timeline.events && timeline.events.length > 0 ? (
                <EventList events={timeline.events} />
              ) : (
                <EventList events={safeEvents} />
              )}
            </div>

            {/* Acciones principales */}
            <DetailActions
              puedeFirmar={puedeFirmar}
              puedeVisar={puedeVisar}
              puedeRechazar={puedeRechazar}
              selectedDoc={selectedDoc}
              setView={setView}
              setSelectedDoc={setSelectedDoc}
              manejarAccionDocumento={manejarAccionDocumento}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
                      {s.status !== "FIRMADO" && (
                        <button
                          type="button"
                          className="btn-main"
                          onClick={() => handleReenviarFirma(s.id)}
                          disabled={reenviarSignerId === s.id}
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: "0.8rem",
                            padding: "6px 10px",
                            borderRadius: 6,
