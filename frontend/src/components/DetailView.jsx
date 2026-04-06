// src/components/DetailView.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timeline } from "./Timeline";
import { EventList } from "./EventList";
import { DetailActions } from "./DetailActions";
import { DOC_STATUS } from "../constants";
import api, { getDocumentTimeline } from "../api/client";
import { ElectronicSignatureNotice } from "./Legal/ElectronicSignatureNotice";
import { useToast } from "../hooks/useToast";

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

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildUserDisplayName(currentUser) {
  const rawName =
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.username ||
    "Usuario";

  const normalizedName = normalizeText(currentUser?.name);
  const normalizedFullName = normalizeText(currentUser?.fullName);
  const normalizedEmail = normalizeText(currentUser?.email);

  const isJean =
    normalizedName === "jean" ||
    normalizedFullName === "jean" ||
    normalizedFullName.includes("jean") ||
    normalizedEmail === "tu-correo@loqueuses.com";

  return isJean ? "Alucard" : rawName;
}

function isAbortLikeError(err) {
  return (
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
}

export function DetailView({
  selectedDoc,
  pdfUrl,
  loadingPdf,
  pdfError,
  puedeFirmar,
  puedeVisar,
  puedeRechazar,
  events,
  manejarAccionDocumento,
  setView,
  setSelectedDoc,
  logout,
  currentUser,
}) {
  const { addToast } = useToast();

  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [signers, setSigners] = useState([]);
  const [loadingSigners, setLoadingSigners] = useState(false);

  const [reenviarLoadingVisado, setReenviarLoadingVisado] = useState(false);
  const [reenviarSignerId, setReenviarSignerId] = useState(null);
  const [recordatorioLoading, setRecordatorioLoading] = useState(false);

  const [acceptedLegalSign, setAcceptedLegalSign] = useState(false);
  const [acceptedLegalVisado, setAcceptedLegalVisado] = useState(false);
  const [signError, setSignError] = useState("");
  const [visadoError, setVisadoError] = useState("");

  const timelineToastShownRef = useRef(false);
  const signersToastShownRef = useRef(false);

  const safeEvents = useMemo(
    () => (Array.isArray(events) ? events : []),
    [events]
  );

  const displayName = useMemo(
    () => buildUserDisplayName(currentUser),
    [currentUser]
  );

  const numeroInterno = useMemo(() => {
    return (
      timeline?.document?.numero_contrato_interno ||
      selectedDoc?.numero_contrato_interno ||
      null
    );
  }, [timeline, selectedDoc]);

  const tramiteLabel = useMemo(
    () =>
      getTramiteLabel(selectedDoc?.tipo_tramite || selectedDoc?.tipoTramite),
    [selectedDoc]
  );

  const documentoLabel = useMemo(
    () =>
      getDocumentoLabel(
        selectedDoc?.tipo_documento || selectedDoc?.tipoDocumento
      ),
    [selectedDoc]
  );

  const isSigned = selectedDoc?.status === DOC_STATUS.FIRMADO;
  const isRejected = selectedDoc?.status === DOC_STATUS.RECHAZADO;

  const mostrarBotonReenvioVisado =
    selectedDoc?.requires_visado === true &&
    selectedDoc?.status === DOC_STATUS.PENDIENTE_VISADO &&
    !!selectedDoc?.visador_email;

  const mostrarBotonRecordatorio =
    selectedDoc?.status === DOC_STATUS.PENDIENTE_VISADO ||
    selectedDoc?.status === DOC_STATUS.PENDIENTE_FIRMA;

  const baseUrl = api.defaults.baseURL || "";
  const downloadUrl = selectedDoc
    ? `${baseUrl}/documents/${selectedDoc.id}/download`
    : null;

  const fetchTimelineAndParticipants = useCallback(
    async (docId) => {
      try {
        setLoadingTimeline(true);
        setLoadingParticipants(true);

        const data = await getDocumentTimeline(docId);

        setTimeline(data?.timeline || null);
        setParticipants(Array.isArray(data?.participants) ? data.participants : []);
        timelineToastShownRef.current = false;
      } catch (err) {
        if (isAbortLikeError(err)) return;

        console.error("Error fetching timeline/participants:", err);
        setTimeline(null);
        setParticipants([]);

        if (!timelineToastShownRef.current) {
          timelineToastShownRef.current = true;
          addToast({
            type: "error",
            title: "No se pudo cargar el flujo",
            message: getErrorMessage(
              err,
              "No se pudo cargar la línea de tiempo del documento."
            ),
          });
        }
      } finally {
        setLoadingTimeline(false);
        setLoadingParticipants(false);
      }
    },
    [addToast]
  );

  const fetchSigners = useCallback(
    async (docId, signal) => {
      try {
        setLoadingSigners(true);

        const res = await api.get(`/documents/${docId}/signers`, { signal });
        const data = res.data;

        setSigners(Array.isArray(data) ? data : []);
        signersToastShownRef.current = false;
      } catch (err) {
        if (isAbortLikeError(err)) return;

        console.error("Error fetching signers:", err);
        setSigners([]);

        if (!signersToastShownRef.current) {
          signersToastShownRef.current = true;
          addToast({
            type: "error",
            title: "No se pudieron cargar los firmantes",
            message: getErrorMessage(
              err,
              "No se pudo cargar la lista de firmantes."
            ),
          });
        }
      } finally {
        setLoadingSigners(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    if (!selectedDoc?.id) return;

    const docId = selectedDoc.id;
    const controller = new AbortController();

    timelineToastShownRef.current = false;
    signersToastShownRef.current = false;

    fetchTimelineAndParticipants(docId);
    fetchSigners(docId, controller.signal);

    const interval = window.setInterval(() => {
      fetchTimelineAndParticipants(docId);
    }, 5000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [selectedDoc?.id, fetchTimelineAndParticipants, fetchSigners]);

  const handleBackToList = useCallback(() => {
    setView("list");
    setSelectedDoc(null);
  }, [setView, setSelectedDoc]);

  const handleReenviarVisado = useCallback(async () => {
    if (!selectedDoc?.id) return;

    try {
      setReenviarLoadingVisado(true);

      const res = await api.post(`/documents/${selectedDoc.id}/reenviar`, {
        tipo: "VISADO",
      });

      addToast({
        type: "success",
        title: "Visado reenviado",
        message:
          res.data?.message || "Recordatorio de visado reenviado correctamente.",
      });
    } catch (err) {
      console.error("Error reenviando visado:", err);

      addToast({
        type: "error",
        title: "No se pudo reenviar el visado",
        message: getErrorMessage(
          err,
          "No se pudo reenviar el correo de visado."
        ),
      });
    } finally {
      setReenviarLoadingVisado(false);
    }
  }, [selectedDoc?.id, addToast]);

  const handleReenviarFirma = useCallback(
    async (signerId) => {
      if (!selectedDoc?.id || !signerId) return;

      try {
        setReenviarSignerId(signerId);

        const res = await api.post(`/documents/${selectedDoc.id}/reenviar`, {
          tipo: "FIRMA",
          signerId,
        });

        addToast({
          type: "success",
          title: "Recordatorio enviado",
          message:
            res.data?.message || "Recordatorio de firma reenviado correctamente.",
        });
      } catch (err) {
        console.error("Error reenviando firma:", err);

        addToast({
          type: "error",
          title: "No se pudo reenviar la firma",
          message: getErrorMessage(
            err,
            "No se pudo reenviar el correo de firma."
          ),
        });
      } finally {
        setReenviarSignerId(null);
      }
    },
    [selectedDoc?.id, addToast]
  );

  const handleEnviarRecordatorioATodos = useCallback(async () => {
    if (!selectedDoc?.id) return;

    try {
      setRecordatorioLoading(true);

      const res = await api.post(`/documents/${selectedDoc.id}/recordatorio`);

      addToast({
        type: "success",
        title: "Recordatorio enviado",
        message: res.data?.message || "Recordatorio enviado correctamente.",
      });
    } catch (err) {
      console.error("Error enviando recordatorio a todos:", err);

      addToast({
        type: "error",
        title: "No se pudo enviar el recordatorio",
        message: getErrorMessage(err, "No se pudo enviar el recordatorio."),
      });
    } finally {
      setRecordatorioLoading(false);
    }
  }, [selectedDoc?.id, addToast]);

  const manejarAccionDocumentoConLegal = useCallback(
    async (id, accion, extraData = {}) => {
      if (accion === "firmar") {
        if (!acceptedLegalSign) {
          setSignError(
            "Debes aceptar el aviso legal de firma electrónica antes de firmar."
          );
          return;
        }
        setSignError("");
      }

      if (accion === "visar") {
        if (!acceptedLegalVisado) {
          setVisadoError(
            "Debes aceptar el aviso legal de visado antes de aprobar el documento."
          );
          return;
        }
        setVisadoError("");
      }

      const ok = await manejarAccionDocumento(id, accion, extraData);

      if (ok) {
        setAcceptedLegalSign(false);
        setAcceptedLegalVisado(false);
        setSignError("");
        setVisadoError("");
      }
    },
    [
      acceptedLegalSign,
      acceptedLegalVisado,
      manejarAccionDocumento,
    ]
  );

  if (!selectedDoc) return null;

  return (
    <div className="detail-layout">
      <aside className="detail-sidebar">
        <h2 className="detail-sidebar-header">VeriFirma</h2>

        <button
          type="button"
          className="nav-item"
          onClick={handleBackToList}
        >
          <span>⬅️</span> Volver a la bandeja
        </button>

        <button
          type="button"
          className="nav-item detail-sidebar-footer"
          onClick={logout}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </aside>

      <main className="main-area">
        <header className="detail-topbar">
          <span className="detail-topbar-title">
            Revisión de documento{" "}
            {numeroInterno ? `(${numeroInterno})` : `#${selectedDoc.id}`} ·
            Estado {selectedDoc.status}
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
                <strong>{numeroInterno || `#${selectedDoc.id}`}</strong> ·
                Estado: <strong>{selectedDoc.status}</strong>
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
                  <strong>Motivo de rechazo:</strong> {selectedDoc.reject_reason}
                </div>
              )}

            <div className="detail-toolbar">
              <span className="detail-toolbar-label">
                Visualización del documento final
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
                      : "🔔 Recordatorio a todos"}
                  </button>
                )}

                {mostrarBotonReenvioVisado && (
                  <button
                    type="button"
                    className="btn-main detail-btn-reminder-visado"
                    onClick={handleReenviarVisado}
                    disabled={reenviarLoadingVisado}
                    style={{
                      cursor: reenviarLoadingVisado ? "not-allowed" : "pointer",
                      opacity: reenviarLoadingVisado ? 0.6 : 1,
                    }}
                  >
                    {reenviarLoadingVisado
                      ? "Reenviando visado..."
                      : "Reenviar visado"}
                  </button>
                )}

                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="btn-main detail-btn-download"
                  >
                    📥 Descargar PDF
                  </a>
                )}

                {pdfUrl && !loadingPdf && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-main detail-btn-view"
                  >
                    👁️ Abrir PDF en otra pestaña
                  </a>
                )}
              </div>
            </div>

            <div className="detail-pdf-wrapper">
              {loadingPdf ? (
                <div className="detail-pdf-empty">
                  Cargando vista previa del PDF...
                </div>
              ) : pdfUrl ? (
                <iframe
                  title={`PDF del documento ${selectedDoc.id}`}
                  src={pdfUrl}
                  className="detail-pdf-iframe"
                />
              ) : (
                <div className="detail-pdf-empty">
                  {pdfError ||
                    'No se pudo cargar la vista previa del PDF. Usa "Descargar PDF" para ver el documento.'}
                </div>
              )}
            </div>

            {puedeFirmar && !isSigned && !isRejected && (
              <ElectronicSignatureNotice
                mode="firma"
                checked={acceptedLegalSign}
                onChange={setAcceptedLegalSign}
              />
            )}

            {signError && (
              <p
                style={{
                  color: "#b91c1c",
                  fontSize: 13,
                  marginBottom: 12,
                  marginTop: -4,
                }}
              >
                {signError}
              </p>
            )}

            {puedeVisar && !isSigned && !isRejected && (
              <ElectronicSignatureNotice
                mode="visado"
                checked={acceptedLegalVisado}
                onChange={setAcceptedLegalVisado}
              />
            )}

            {visadoError && (
              <p
                style={{
                  color: "#b91c1c",
                  fontSize: 13,
                  marginBottom: 12,
                  marginTop: -4,
                }}
              >
                {visadoError}
              </p>
            )}

            <div className="detail-signers">
              <h3 className="detail-signers-title">Firmantes</h3>

              {loadingSigners ? (
                <p className="detail-signers-loading">Cargando firmantes...</p>
              ) : signers.length === 0 ? (
                <p className="detail-signers-empty">
                  No hay firmantes registrados para este documento.
                </p>
              ) : (
                <ul className="detail-signers-list">
                  {signers.map((s) => {
                    const isPendingSigner =
                      s.status !== "FIRMADO" && s.status !== "RECHAZADO";

                    return (
                      <li key={s.id} className="detail-signers-item">
                        <div>
                          <div className="detail-signer-main">
                            {s.name || "Firmante"}
                          </div>
                          <div className="detail-signer-sub">
                            {s.email} · Estado: {s.status}
                          </div>
                        </div>

                        {isPendingSigner && (
                          <button
                            type="button"
                            className="btn-main"
                            style={{
                              padding: "8px 16px",
                              fontSize: "0.85rem",
                              backgroundColor: "#3b82f6",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor:
                                reenviarSignerId === s.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: reenviarSignerId === s.id ? 0.6 : 1,
                            }}
                            onClick={() => handleReenviarFirma(s.id)}
                            disabled={reenviarSignerId === s.id}
                          >
                            {reenviarSignerId === s.id
                              ? "⏳ Enviando..."
                              : "📧 Enviar recordatorio"}
                          </button>
                        )}

                        {s.status === "FIRMADO" && (
                          <span
                            style={{
                              padding: "6px 12px",
                              fontSize: "0.8rem",
                              background: "#dcfce7",
                              color: "#16a34a",
                              borderRadius: 6,
                              fontWeight: 600,
                            }}
                          >
                            ✓ Firmado
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="detail-signers" style={{ marginTop: 24 }}>
              <h3 className="detail-signers-title">Flujo de participantes</h3>

              {loadingParticipants ? (
                <p className="detail-signers-loading">
                  Cargando flujo de participantes...
                </p>
              ) : participants.length === 0 ? (
                <p className="detail-signers-empty">
                  No hay participantes registrados para este documento.
                </p>
              ) : (
                <ul className="detail-signers-list">
                  {participants.map((p) => (
                    <li key={p.id} className="detail-signers-item">
                      <div>
                        <div className="detail-signer-main">
                          #{p.flow_order} · {p.role_in_doc} · {p.name}
                        </div>
                        <div className="detail-signer-sub">
                          {p.email} · Estado: {p.status}
                          {p.signed_at &&
                            ` · firmado el ${new Date(
                              p.signed_at
                            ).toLocaleString()}`}
                        </div>
                      </div>
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
                  No hay datos de progreso disponibles.
                </div>
              )}
            </div>

            <div className="detail-history">
              <h3 className="detail-history-title">Historial de acciones</h3>

              {timeline?.events?.length > 0 ? (
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
              manejarAccionDocumento={manejarAccionDocumentoConLegal}
              isAdmin={true}
            />
          </div>
        </div>
      </main>
    </div>
  );
}