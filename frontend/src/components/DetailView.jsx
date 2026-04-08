// src/components/DetailView.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timeline } from "./Timeline";
import { EventList } from "./EventList";
import { DetailActions } from "./DetailActions";
import api, { getDocumentTimeline } from "../api/client";
import { ElectronicSignatureNotice } from "./Legal/ElectronicSignatureNotice";
import { useToast } from "../hooks/useToast";
import "../styles/detailView.css";
import {
  DETAIL_POLL_INTERVAL_MS,
  FLOW_ROLE_KEYS,
  REMINDER_TYPES,
} from "./detailView.constants";
import {
  buildDocumentStateMeta,
  buildFlowParticipants,
  buildUserDisplayName,
  formatDateTime,
  getDocumentLabel,
  getDocumentNumber,
  getDocumentTitle,
  getErrorMessage,
  getTimelineEvents,
  getTramiteLabel,
  isAbortLikeError,
  shouldShowGlobalReminder,
  shouldShowVisadoReminder,
} from "./detailView.helpers";

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

  const safeEvents = useMemo(() => {
    return getTimelineEvents(timeline, events);
  }, [timeline, events]);

  const displayName = useMemo(() => {
    return buildUserDisplayName(currentUser);
  }, [currentUser]);

  const numeroInterno = useMemo(() => {
    return getDocumentNumber(selectedDoc, timeline);
  }, [selectedDoc, timeline]);

  const titleDocumento = useMemo(() => {
    return getDocumentTitle(selectedDoc, timeline);
  }, [selectedDoc, timeline]);

  const tramiteLabel = useMemo(() => {
    return getTramiteLabel(
      timeline?.document?.tipo_tramite ??
        selectedDoc?.tipo_tramite ??
        selectedDoc?.tipoTramite
    );
  }, [timeline, selectedDoc]);

  const documentoLabel = useMemo(() => {
    return getDocumentLabel(
      timeline?.document?.tipo_documento ??
        selectedDoc?.tipo_documento ??
        selectedDoc?.tipoDocumento
    );
  }, [timeline, selectedDoc]);

  const currentStatus = useMemo(() => {
    return timeline?.document?.status ?? selectedDoc?.status ?? null;
  }, [timeline, selectedDoc]);

  const currentDocId = selectedDoc?.id ?? timeline?.document?.id ?? null;

  const isSigned = currentStatus === "FIRMADO";
  const isRejected = currentStatus === "RECHAZADO";

  const mostrarBotonReenvioVisado = useMemo(() => {
    return shouldShowVisadoReminder(selectedDoc, currentStatus);
  }, [selectedDoc, currentStatus]);

  const mostrarBotonRecordatorio = useMemo(() => {
    return shouldShowGlobalReminder(currentStatus);
  }, [currentStatus]);

  const baseUrl = api.defaults.baseURL || "";
  const downloadUrl = currentDocId
    ? `${baseUrl}/documents/${currentDocId}/download`
    : null;

  const documentStateMeta = useMemo(() => {
    return buildDocumentStateMeta(currentStatus);
  }, [currentStatus]);

  const flowParticipants = useMemo(() => {
    return buildFlowParticipants(participants, signers);
  }, [participants, signers]);

  const nextPendingParticipant = useMemo(() => {
    return flowParticipants.find((p) => p.statusKey === "pending") || null;
  }, [flowParticipants]);

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
        setSigners(Array.isArray(res.data) ? res.data : []);
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

    const intervalId = window.setInterval(() => {
      fetchTimelineAndParticipants(docId);
    }, DETAIL_POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
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
        tipo: REMINDER_TYPES.VISADO,
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
          tipo: REMINDER_TYPES.FIRMA,
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
    [acceptedLegalSign, acceptedLegalVisado, manejarAccionDocumento]
  );

  if (!selectedDoc) return null;

  return (
    <div className="detail-layout">
      <aside className="detail-sidebar">
        <h2 className="detail-sidebar-header">VeriFirma</h2>

        <button type="button" className="nav-item" onClick={handleBackToList}>
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
            {numeroInterno ? `(${numeroInterno})` : currentDocId ? `#${currentDocId}` : ""}
            {" · "}
            Estado {currentStatus || "Sin estado"}
          </span>

          <span className="detail-topbar-user">
            Hola, <span>{displayName}</span>
          </span>
        </header>

        <div className="detail-container">
          <div className="detail-card">
            <div className="detail-header-block">
              <div className="detail-header-main">
                <h1 className="detail-title">{titleDocumento}</h1>

                <div className="detail-meta">
                  <p>
                    <span className="detail-meta-label">N° interno:</span>{" "}
                    <span className="detail-meta-value">
                      {numeroInterno || (currentDocId ? `#${currentDocId}` : "N/D")}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">Tipo de trámite:</span>{" "}
                    <span className="detail-meta-value">{tramiteLabel}</span>
                  </p>

                  <p>
                    <span className="detail-meta-label">Tipo de documento:</span>{" "}
                    <span className="detail-meta-value">{documentoLabel}</span>
                  </p>
                </div>
              </div>

              <div className={documentStateMeta.className}>
                <div className="detail-doc-state__label">
                  {documentStateMeta.label}
                </div>
                <div className="detail-doc-state__helper">
                  {documentStateMeta.helper}
                </div>
              </div>
            </div>

            {selectedDoc.description && (
              <div className="detail-description">
                <strong>Descripción:</strong> {selectedDoc.description}
              </div>
            )}

            {isRejected && selectedDoc.reject_reason && (
              <div className="detail-reject-box">
                <strong>Motivo de rechazo:</strong> {selectedDoc.reject_reason}
              </div>
            )}

            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Documento y acciones</h3>
                <p className="detail-section__subtitle">
                  Visualiza el PDF final, descarga el archivo o reenvía recordatorios
                  según el estado actual.
                </p>
              </div>

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
                    <a href={downloadUrl} className="btn-main detail-btn-download">
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
                    title={`PDF del documento ${currentDocId || ""}`}
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
            </section>

            {(puedeFirmar || puedeVisar) && !isSigned && !isRejected && (
              <section className="detail-section">
                <div className="detail-section__header">
                  <h3 className="detail-section__title">Validaciones previas</h3>
                  <p className="detail-section__subtitle">
                    Antes de firmar o visar, deja constancia de aceptación del aviso
                    legal correspondiente.
                  </p>
                </div>

                {puedeFirmar && (
                  <>
                    <ElectronicSignatureNotice
                      mode="firma"
                      checked={acceptedLegalSign}
                      onChange={setAcceptedLegalSign}
                    />
                    {signError && (
                      <p className="detail-inline-error">{signError}</p>
                    )}
                  </>
                )}

                {puedeVisar && (
                  <>
                    <ElectronicSignatureNotice
                      mode="visado"
                      checked={acceptedLegalVisado}
                      onChange={setAcceptedLegalVisado}
                    />
                    {visadoError && (
                      <p className="detail-inline-error">{visadoError}</p>
                    )}
                  </>
                )}
              </section>
            )}

            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Flujo de participantes</h3>
                <p className="detail-section__subtitle">
                  Revisa el orden del proceso, el rol de cada participante y quién
                  sigue en el flujo secuencial.
                </p>
              </div>

              {loadingParticipants || loadingSigners ? (
                <p className="detail-signers-loading">
                  Cargando flujo de participantes...
                </p>
              ) : flowParticipants.length === 0 ? (
                <p className="detail-signers-empty">
                  No hay participantes registrados para este documento.
                </p>
              ) : (
                <>
                  <div className="detail-flow-summary">
                    <div className="detail-flow-summary__label">Próximo paso</div>
                    <div className="detail-flow-summary__value">
                      {nextPendingParticipant
                        ? `#${nextPendingParticipant.order} · ${nextPendingParticipant.roleLabel} · ${nextPendingParticipant.name}`
                        : "No hay participantes pendientes"}
                    </div>
                  </div>

                  <ul className="detail-flow-list">
                    {flowParticipants.map((participant) => {
                      const normalizedParticipantEmail = String(
                        participant.email || ""
                      ).toLowerCase();

                      const signerMatch = signers.find((s) => {
                        const signerEmail = String(s?.email || "").toLowerCase();

                        return (
                          String(s?.id) === String(participant.id) ||
                          (normalizedParticipantEmail &&
                            signerEmail &&
                            signerEmail === normalizedParticipantEmail)
                        );
                      });

                      const signerId = signerMatch?.id;
                      const canRemind =
                        participant.roleKey === FLOW_ROLE_KEYS.FIRMANTE &&
                        participant.statusKey === "pending" &&
                        Boolean(signerId);

                      return (
                        <li key={participant.id} className="detail-flow-item">
                          <div className="detail-flow-item__order">
                            {participant.order}
                          </div>

                          <div className="detail-flow-item__body">
                            <div className="detail-flow-item__top">
                              <div>
                                <div className="detail-flow-item__name">
                                  {participant.name}
                                </div>
                                <div className="detail-flow-item__email">
                                  {participant.email || "Sin correo registrado"}
                                </div>
                              </div>

                              <div className="detail-flow-item__badges">
                                <span className={participant.roleBadgeClass}>
                                  {participant.roleLabel}
                                </span>
                                <span className={participant.statusClassName}>
                                  {participant.statusLabel}
                                </span>
                              </div>
                            </div>

                            <div className="detail-flow-item__meta">
                              {participant.signedAt ? (
                                <span>
                                  Registrado el {formatDateTime(participant.signedAt)}
                                </span>
                              ) : (
                                <span>Aún no registra acción</span>
                              )}
                            </div>
                          </div>

                          {canRemind ? (
                            <button
                              type="button"
                              className="btn-main detail-btn-inline-reminder"
                              onClick={() => handleReenviarFirma(signerId)}
                              disabled={reenviarSignerId === signerId}
                              style={{
                                cursor:
                                  reenviarSignerId === signerId
                                    ? "not-allowed"
                                    : "pointer",
                                opacity: reenviarSignerId === signerId ? 0.6 : 1,
                              }}
                            >
                              {reenviarSignerId === signerId
                                ? "⏳ Enviando..."
                                : "📧 Recordar"}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Timeline del documento</h3>
                <p className="detail-section__subtitle">
                  Consulta el avance general y distingue eventos automáticos de
                  acciones realizadas por usuarios.
                </p>
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
            </section>

            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Historial de acciones</h3>
                <p className="detail-section__subtitle">
                  Registro detallado de eventos del documento para seguimiento y
                  auditoría.
                </p>
              </div>

              <div className="detail-history">
                <EventList events={safeEvents} />
              </div>
            </section>

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