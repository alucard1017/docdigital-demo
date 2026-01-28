// src/components/DetailView.jsx
import React from "react";
import { EventList } from "./EventList";
import { DetailActions } from "./DetailActions";
import { DetailHeader } from "./DetailHeader";
import { DOC_STATUS } from "../constants";

export function DetailView({
  selectedDoc,
  pdfUrl,
  puedeFirmar,
  puedeRechazar,
  events,
  manejarAccionDocumento,
  setView,
  setSelectedDoc,
  logout,
}) {
  if (!selectedDoc) return null;

  return (
    <div className="dashboard-layout">
      {/* Sidebar simple */}
      <aside className="sidebar">
        <h2>Firma Express</h2>

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
            Revisión de Documento #{selectedDoc.id} - Estado {selectedDoc.status}
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

            {/* Descripción */}
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
              <strong>Descripción:</strong>{" "}
              {selectedDoc.description || "Sin descripción registrada."}
            </div>

            {/* Motivo de rechazo si aplica */}
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

            {/* Barra de descarga */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                }}
              >
                Visualización del documento original
              </span>

              {selectedDoc.file_url && (
                <a
                  href={pdfUrl}
                  download
                  className="btn-main"
                  style={{
                    background: "#e5e7eb",
                    color: "#111827",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    padding: "6px 12px",
                  }}
                >
                  Descargar PDF
                </a>
              )}
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
              {selectedDoc.file_url ? (
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
                <div
                  style={{
                    padding: 24,
                    color: "#e5e7eb",
                  }}
                >
                  No se encontró el archivo PDF para este documento.
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

              <EventList events={events} />
            </div>

            {/* Botones Firmar / Rechazar */}
            <DetailActions
              puedeFirmar={puedeFirmar}
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
