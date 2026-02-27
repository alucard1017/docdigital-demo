import React, { useState, useEffect } from "react";
import { Timeline } from "./Timeline";
import { EventList } from "./EventList";
import { DetailActions } from "./DetailActions";
import { DOC_STATUS, API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function getTramiteLabel(value) {
  if (value === "notaria") return "Notaría";
  if (value === "propio") return "Propio";
  return "N/D";
}

function getDocumentoLabel(value) {
  if (value === "poderes") return "Poderes y autorizaciones";
  if (value === "contratos") return "Solo contratos";
  return "N/D";
}

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
  currentUser, // <- NUEVO
}) {
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [signers, setSigners] = useState([]);
  const [loadingSigners, setLoadingSigners] = useState(false);
  const [reenviarLoadingVisado, setReenviarLoadingVisado] = useState(false);
  const [reenviarSignerId, setReenviarSignerId] = useState(null);
  const [recordatorioLoading, setRecordatorioLoading] = useState(false);

  // nombre dinámico + override para ti
  const rawName =
    currentUser?.name || currentUser?.fullName || "Usuario";
  const isJean =
    currentUser &&
    (currentUser.email === "tu-correo@loqueuses.com" ||
      currentUser.name === "Jean");
  const displayName = isJean ? "Alucard" : rawName;

  useEffect(() => {
    if (!selectedDoc?.id) return;

    const docId = selectedDoc.id;

    const fetchTimeline = async () => {
      try {
        setLoadingTimeline(true);
        const res = await fetch(`${API_URL}/api/docs/${docId}/timeline`);
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
        const res = await fetch(`${API_URL}/api/docs/${docId}/signers`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
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
  }, [selectedDoc?.id, token]);

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

  const tramiteLabel = getTramiteLabel(
    selectedDoc.tipo_tramite || selectedDoc.tipoTramite
  );
  const documentoLabel = getDocumentoLabel(
    selectedDoc.tipo_documento || selectedDoc.tipoDocumento
  );

  return (
    <div className="detail-layout">
      <aside className="detail-sidebar">
        <h2 className="detail-sidebar-header">VeriFirma</h2>

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
          className="nav-item detail-sidebar-footer"
          onClick={logout}
        >
          <span>🚪</span> Cerrar Sesión
        </div>
      </aside>

      <main className="main-area">
        <header className="detail-topbar">
          <span className="detail-topbar-title">
            Revisión de Documento{" "}
            {numeroInterno ? `(${numeroInterno})` : `#${selectedDoc.id}`} - Estado{" "}
            {selectedDoc.status}
          </span>
          <span className="detail-topbar-user">
            Hola, <span>{displayName}</span>
          </span>
        </header>

        <div className="detail-container">
          <div className="detail-card">
            <h1 className="detail-title">
              {selectedDoc.title || "Documento sin título"}
            </h1>

            <div className="detail-meta">
              <p>
                N° interno:{" "}
                <strong>{numeroInterno || `#${selectedDoc.id}`}</strong> · Estado:{" "}
                <strong>{selectedDoc.status}</strong>
              </p>
              <p>
                Tipo de trámite:{" "}
                <strong>
                  {tramiteLabel} – {documentoLabel}
                </strong>
              </p>
            </div>

            {selectedDoc.description && (
              <div className="detail-description">
                <strong>Descripción:</strong> {selectedDoc.description}
              </div>
            )}

            {selectedDoc.status === DOC_STATUS.RECHAZADO &&
              selectedDoc.reject_reason && (
                <div className="detail-reject-box">
                  <strong>Motivo de rechazo:</strong>{" "}
                  {selectedDoc.reject_reason}
                </div>
              )}

            <div className="detail-toolbar">
              <span className="detail-toolbar-label">
                Visualización del documento original
              </span>

              <div className="detail-toolbar-actions">
                {mostrarBotonRecordatorio && (
                  <button
                    type="button"
                    className="btn-main detail-btn-reminder-all"
                    onClick={handleEnviarRecordatorioATodos}
                    disabled={recordatorioLoading}
                    style={{
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
                    className="btn-main detail-btn-reminder-visado"
                    onClick={handleReenviarVisado}
                    disabled={reenviarLoadingVisado}
                  >
                    {reenviarLoadingVisado
                      ? "Reenviando..."
                      : "Reenviar visado"}
                  </button>
                )}

                {selectedDoc && (
                  <a
                    href={`${API_URL}/api/docs/${selectedDoc.id}/download`}
                    className="btn-main detail-btn-download"
                  >
                    📥 Descargar PDF
                  </a>
                )}

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-main detail-btn-view"
                  >
                    👁️ Ver PDF
                  </a>
                )}
              </div>
            </div>

            <div className="detail-pdf-wrapper">
              {pdfUrl ? (
                <iframe
                  title="PDF del documento"
                  src={pdfUrl}
                  className="detail-pdf-iframe"
                />
              ) : (
                <div className="detail-pdf-empty">
                  No se encontró el archivo PDF para este documento.
                </div>
              )}
            </div>

            <div className="detail-signers">
              <h3 className="detail-signers-title">Firmantes</h3>

              {loadingSigners ? (
                <p className="detail-signers-loading">
                  Cargando firmantes...
                </p>
              ) : signers.length === 0 ? (
                <p className="detail-signers-empty">
                  No hay firmantes registrados para este documento.
                </p>
              ) : (
                <ul className="detail-signers-list">
                  {signers.map((s) => (
                    <li key={s.id} className="detail-signers-item">
                      <div>
                        <div className="detail-signer-main">
                          {s.name || "Firmante"}
                        </div>
                        <div className="detail-signer-sub">
                          {s.email} · Estado: {s.status}
                        </div>
                      </div>

                      {s.status !== "FIRMADO" && (
                        <button
                          type="button"
                          className="btn-main detail-btn-reminder-signer"
                          onClick={() => handleReenviarFirma(s.id)}
                          disabled={reenviarSignerId === s.id}
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

            <div className="detail-timeline-wrapper">
              {loadingTimeline ? (
                <div className="detail-timeline-loading">
                  Cargando progreso...
                </div>
              ) : timeline ? (
                <Timeline timeline={timeline} />
              ) : (
                <div className="detail-timeline-empty">
                  No hay datos de progreso disponibles
                </div>
              )}
            </div>

            <div className="detail-history">
              <h3 className="detail-history-title">
                Historial de acciones
              </h3>

              {timeline && timeline.events && timeline.events.length > 0 ? (
                <EventList events={timeline.events} />
              ) : (
                <EventList events={safeEvents} />
              )}
            </div>

            <DetailActions
              puedeFirmar={puedeFirmar}
              puedeVisar={puedeVisar}
              puedeRechazar={puedeRechazar}
              selectedDoc={selectedDoc}
              setView={setView}
              setSelectedDoc={setSelectedDoc}
              manejarAccionDocumento={manejarAccionDocumento}
              isAdmin={true}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
