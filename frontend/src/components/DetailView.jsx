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
}) {
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [reenviarLoading, setReenviarLoading] = useState(false);

  useEffect(() => {
    if (!selectedDoc) return;

    const fetchTimeline = async () => {
      try {
        setLoadingTimeline(true);
        const res = await fetch(`${API_URL}/api/docs/${selectedDoc.id}/timeline`);
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

    fetchTimeline();
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [selectedDoc]);

  if (!selectedDoc) return null;

  const safeEvents = Array.isArray(events) ? events : [];

  const mostrarBotonReenvioVisado =
    selectedDoc.requires_visado === true &&
    selectedDoc.status === DOC_STATUS.PENDIENTE_VISADO &&
    selectedDoc.visador_email;

  async function handleReenviarVisado() {
    if (!selectedDoc) return;
    try {
      setReenviarLoading(true);
      const res = await fetch(`${API_URL}/api/docs/${selectedDoc.id}/reenviar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tipo: "VISADO" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No se pudo reenviar el correo de visado");
      }
      alert(data.message || "Recordatorio de visado reenviado");
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setReenviarLoading(false);
    }
  }

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
            Revisión de Documento #{selectedDoc.id} - Estado{" "}
            {selectedDoc.status}
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
              N° de contrato #{selectedDoc.id} · Estado:{" "}
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
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Visualización del documento original
              </span>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {mostrarBotonReenvioVisado && (
                  <button
                    type="button"
                    className="btn-main"
                    onClick={handleReenviarVisado}
                    disabled={reenviarLoading}
                    style={{
                      background: "#fbbf24",
                      color: "#92400e",
                      fontSize: "0.8rem",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    {reenviarLoading
                      ? "Reenviando visado..."
                      : "Reenviar correo de visado"}
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
                    👁️ Ver en nueva pestaña
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

            {/* Acciones principales (firmar / visar / rechazar) */}
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
