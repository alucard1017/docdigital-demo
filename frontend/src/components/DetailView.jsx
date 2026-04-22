import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  getDocumentNumber,
  getDocumentTitle,
  getErrorMessage,
  getTimelineEvents,
  getNormalizedDocumentStatus,
  isAbortLikeError,
  shouldShowGlobalReminder,
  shouldShowVisadoReminder,
} from "./detailView.helpers";
import {
  getDocumentKindLabel,
  getNotaryLabel,
  getProcedureLabel,
  getProcedureFieldLabel,
} from "../utils/documentLabels";
import {
  canViewAuditLogs,
  canManageReminders,
} from "../utils/permissions";
import { DOC_STATUS } from "../constants";

function getButtonStateStyle(isLoading) {
  return {
    cursor: isLoading ? "not-allowed" : "pointer",
    opacity: isLoading ? 0.6 : 1,
  };
}

function DetailSection({ title, subtitle, children }) {
  return (
    <section className="detail-section">
      <div className="detail-section__header">
        <h3 className="detail-section__title">{title}</h3>
        {subtitle ? (
          <p className="detail-section__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PdfViewerPanel({
  currentDocId,
  pdfUrl,
  loadingPdf,
  pdfError,
  downloadUrl,
  mostrarBotonRecordatorio,
  mostrarBotonReenvioVisado,
  recordatorioLoading,
  reenviarLoadingVisado,
  onEnviarRecordatorioATodos,
  onReenviarVisado,
}) {
  return (
    <DetailSection
      title="Documento y acciones"
      subtitle="Visualiza el PDF final, descarga el archivo o reenvía recordatorios según el estado actual."
    >
      <div className="detail-toolbar">
        <span className="detail-toolbar-label">
          Visualización del documento final
        </span>

        <div className="detail-toolbar-actions">
          {mostrarBotonRecordatorio ? (
            <button
              type="button"
              className="btn-main detail-btn-reminder-all"
              onClick={onEnviarRecordatorioATodos}
              disabled={recordatorioLoading}
              style={getButtonStateStyle(recordatorioLoading)}
            >
              {recordatorioLoading
                ? "Enviando recordatorio..."
                : "🔔 Recordatorio a todos"}
            </button>
          ) : null}

          {mostrarBotonReenvioVisado ? (
            <button
              type="button"
              className="btn-main detail-btn-reminder-visado"
              onClick={onReenviarVisado}
              disabled={reenviarLoadingVisado}
              style={getButtonStateStyle(reenviarLoadingVisado)}
            >
              {reenviarLoadingVisado
                ? "Reenviando visado..."
                : "Reenviar visado"}
            </button>
          ) : null}

          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="btn-main detail-btn-download"
              target="_blank"
              rel="noopener noreferrer"
            >
              📥 Descargar PDF
            </a>
          ) : null}

          {pdfUrl && !loadingPdf ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-main detail-btn-view"
            >
              👁️ Abrir PDF en otra pestaña
            </a>
          ) : null}
        </div>
      </div>

      <div className="detail-pdf-wrapper">
        {loadingPdf ? (
          <div className="detail-pdf-empty" role="status" aria-live="polite">
            Cargando vista previa del PDF...
          </div>
        ) : pdfUrl ? (
          <iframe
            title={`PDF del documento ${currentDocId || ""}`}
            src={pdfUrl}
            className="detail-pdf-iframe"
          />
        ) : (
          <div className="detail-pdf-empty" role="status" aria-live="polite">
            {pdfError ||
              'No se pudo cargar la vista previa del PDF. Usa "Descargar PDF" para ver el documento.'}
          </div>
        )}
      </div>
    </DetailSection>
  );
}

function LegalValidationSection({
  puedeFirmar,
  puedeVisar,
  isSigned,
  isRejected,
  acceptedLegalSign,
  acceptedLegalVisado,
  signError,
  visadoError,
  setAcceptedLegalSign,
  setAcceptedLegalVisado,
  setSignError,
  setVisadoError,
}) {
  if ((!puedeFirmar && !puedeVisar) || isSigned || isRejected) {
    return null;
  }

  return (
    <DetailSection
      title="Validaciones previas"
      subtitle="Antes de firmar o visar, deja constancia de aceptación del aviso legal correspondiente."
    >
      {puedeFirmar ? (
        <>
          <ElectronicSignatureNotice
            mode="firma"
            checked={acceptedLegalSign}
            onChange={(value) => {
              setAcceptedLegalSign(value);
              if (value) setSignError("");
            }}
          />
          {signError ? (
            <p className="detail-inline-error" role="alert">
              {signError}
            </p>
          ) : null}
        </>
      ) : null}

      {puedeVisar ? (
        <>
          <ElectronicSignatureNotice
            mode="visado"
            checked={acceptedLegalVisado}
            onChange={(value) => {
              setAcceptedLegalVisado(value);
              if (value) setVisadoError("");
            }}
          />
          {visadoError ? (
            <p className="detail-inline-error" role="alert">
              {visadoError}
            </p>
          ) : null}
        </>
      ) : null}
    </DetailSection>
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

  const canSeeActionHistory = useMemo(
    () => canViewAuditLogs(currentUser),
    [currentUser]
  );

  const canManageDocumentReminders = useMemo(
    () => canManageReminders(currentUser),
    [currentUser]
  );

  const currentTimelineDoc = timeline?.document || null;

  const currentDocId = useMemo(
    () => selectedDoc?.id ?? currentTimelineDoc?.id ?? null,
    [selectedDoc?.id, currentTimelineDoc?.id]
  );

  const mergedDoc = useMemo(
    () => ({
      ...(selectedDoc || {}),
      ...(currentTimelineDoc || {}),
      metadata: {
        ...(selectedDoc?.metadata || selectedDoc?.meta || {}),
        ...(currentTimelineDoc?.metadata || currentTimelineDoc?.meta || {}),
      },
    }),
    [selectedDoc, currentTimelineDoc]
  );

  const safeEvents = useMemo(
    () => getTimelineEvents(timeline, events),
    [timeline, events]
  );

  const displayName = useMemo(
    () => buildUserDisplayName(currentUser),
    [currentUser]
  );

  const numeroInterno = useMemo(
    () => getDocumentNumber(mergedDoc, timeline),
    [mergedDoc, timeline]
  );

  const numeroInternoDisplay = useMemo(
    () => numeroInterno || (currentDocId ? `#${currentDocId}` : "N/D"),
    [numeroInterno, currentDocId]
  );

  const titleDocumento = useMemo(
    () => getDocumentTitle(mergedDoc, timeline),
    [mergedDoc, timeline]
  );

  const clasificacionFieldLabel = useMemo(
    () => getProcedureFieldLabel(mergedDoc),
    [mergedDoc]
  );

  const clasificacionLabel = useMemo(
    () => getProcedureLabel(mergedDoc),
    [mergedDoc]
  );

  const tramiteLabel = useMemo(
    () => getNotaryLabel(mergedDoc) || "No informado",
    [mergedDoc]
  );

  const documentoLabel = useMemo(
    () => getDocumentKindLabel(mergedDoc) || "No informado",
    [mergedDoc]
  );

  const currentStatus = useMemo(
    () => getNormalizedDocumentStatus(mergedDoc, timeline),
    [mergedDoc, timeline]
  );

  const isSigned = currentStatus === DOC_STATUS.FIRMADO;
  const isRejected = currentStatus === DOC_STATUS.RECHAZADO;
  const flujoFinalizado = isSigned || isRejected;

  const mostrarBotonReenvioVisado = useMemo(
    () =>
      canManageDocumentReminders &&
      shouldShowVisadoReminder(mergedDoc, currentStatus),
    [canManageDocumentReminders, mergedDoc, currentStatus]
  );

  const mostrarBotonRecordatorio = useMemo(
    () =>
      canManageDocumentReminders &&
      shouldShowGlobalReminder(currentStatus),
    [canManageDocumentReminders, currentStatus]
  );

  const baseUrl = api.defaults.baseURL || "";
  const downloadUrl = currentDocId
    ? `${baseUrl}/documents/${currentDocId}/download`
    : null;

  const documentStateMeta = useMemo(
    () => buildDocumentStateMeta(currentStatus),
    [currentStatus]
  );

  const flowParticipants = useMemo(
    () => buildFlowParticipants(participants, signers),
    [participants, signers]
  );

  const nextPendingParticipant = useMemo(
    () => flowParticipants.find((p) => p.statusKey === "pending") || null,
    [flowParticipants]
  );

  const handleBackToList = useCallback(() => {
    if (typeof setView === "function") setView("list");
    if (typeof setSelectedDoc === "function") setSelectedDoc(null);
  }, [setView, setSelectedDoc]);

  const showErrorToastOnce = useCallback(
    (ref, config) => {
      if (ref.current) return;
      ref.current = true;
      addToast(config);
    },
    [addToast]
  );

  const refreshTimeline = useCallback(
    async (docId) => {
      if (!docId) return;

      try {
        setLoadingTimeline(true);
        setLoadingParticipants(true);

        const data = await getDocumentTimeline(docId);

        setTimeline(data || null);
        setParticipants(
          Array.isArray(data?.participants) ? data.participants : []
        );
        timelineToastShownRef.current = false;
      } catch (err) {
        if (isAbortLikeError(err)) return;

        console.error("Error fetching timeline/participants:", err);
        setTimeline(null);
        setParticipants([]);

        showErrorToastOnce(timelineToastShownRef, {
          type: "error",
          title: "No se pudo cargar el flujo",
          message: getErrorMessage(
            err,
            "No se pudo cargar la línea de tiempo del documento."
          ),
        });
      } finally {
        setLoadingTimeline(false);
        setLoadingParticipants(false);
      }
    },
    [showErrorToastOnce]
  );

  const refreshSigners = useCallback(
    async (docId, signal) => {
      if (!docId) return;

      try {
        setLoadingSigners(true);

        const res = await api.get(`/documents/${docId}/signers`, { signal });
        setSigners(Array.isArray(res.data) ? res.data : []);
        signersToastShownRef.current = false;
      } catch (err) {
        if (isAbortLikeError(err)) return;

        console.error("Error fetching signers:", err);
        setSigners([]);

        showErrorToastOnce(signersToastShownRef, {
          type: "error",
          title: "No se pudieron cargar los firmantes",
          message: getErrorMessage(
            err,
            "No se pudo cargar la lista de firmantes."
          ),
        });
      } finally {
        setLoadingSigners(false);
      }
    },
    [showErrorToastOnce]
  );

  const refreshAll = useCallback(
    async (docId, signal) => {
      if (!docId) return;

      await Promise.allSettled([
        refreshTimeline(docId),
        refreshSigners(docId, signal),
      ]);
    },
    [refreshTimeline, refreshSigners]
  );

  useEffect(() => {
    if (!selectedDoc?.id) return;

    const docId = selectedDoc.id;
    const controller = new AbortController();
    let isMounted = true;

    timelineToastShownRef.current = false;
    signersToastShownRef.current = false;

    const runInitialLoad = async () => {
      if (!isMounted) return;
      await refreshAll(docId, controller.signal);
    };

    runInitialLoad();

    const intervalId = window.setInterval(() => {
      if (!isMounted || controller.signal.aborted) return;
      refreshAll(docId, controller.signal);
    }, DETAIL_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [selectedDoc?.id, refreshAll]);

  const runRefreshableAction = useCallback(
    async ({ request, successToast, errorToast, loadingSetter }) => {
      try {
        if (typeof loadingSetter === "function") {
          loadingSetter(true);
        }

        const res = await request();

        addToast({
          type: "success",
          title: successToast.title,
          message: res?.data?.message || successToast.message,
        });

        if (currentDocId) {
          await refreshAll(currentDocId);
        }
      } catch (err) {
        console.error(errorToast.logLabel, err);

        addToast({
          type: "error",
          title: errorToast.title,
          message: getErrorMessage(err, errorToast.message),
        });
      } finally {
        if (typeof loadingSetter === "function") {
          loadingSetter(false);
        }
      }
    },
    [addToast, currentDocId, refreshAll]
  );

  const handleReenviarVisado = useCallback(async () => {
    if (!currentDocId || flujoFinalizado) return;

    await runRefreshableAction({
      loadingSetter: setReenviarLoadingVisado,
      request: () =>
        api.post(`/documents/${currentDocId}/reenviar`, {
          tipo: REMINDER_TYPES.VISADO,
        }),
      successToast: {
        title: "Visado reenviado",
        message: "Recordatorio de visado reenviado correctamente.",
      },
      errorToast: {
        title: "No se pudo reenviar el visado",
        message: "No se pudo reenviar el correo de visado.",
        logLabel: "Error reenviando visado:",
      },
    });
  }, [currentDocId, flujoFinalizado, runRefreshableAction]);

  const handleReenviarFirma = useCallback(
    async (signerId) => {
      if (!currentDocId || !signerId || flujoFinalizado) return;

      try {
        setReenviarSignerId(signerId);

        const res = await api.post(`/documents/${currentDocId}/reenviar`, {
          tipo: REMINDER_TYPES.FIRMA,
          signerId,
        });

        addToast({
          type: "success",
          title: "Recordatorio enviado",
          message:
            res.data?.message ||
            "Recordatorio de firma reenviado correctamente.",
        });

        await refreshAll(currentDocId);
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
    [currentDocId, flujoFinalizado, addToast, refreshAll]
  );

  const handleEnviarRecordatorioATodos = useCallback(async () => {
    if (!currentDocId || flujoFinalizado) return;

    await runRefreshableAction({
      loadingSetter: setRecordatorioLoading,
      request: () => api.post(`/documents/${currentDocId}/recordatorio`),
      successToast: {
        title: "Recordatorio enviado",
        message: "Recordatorio enviado correctamente.",
      },
      errorToast: {
        title: "No se pudo enviar el recordatorio",
        message: "No se pudo enviar el recordatorio.",
        logLabel: "Error enviando recordatorio a todos:",
      },
    });
  }, [currentDocId, flujoFinalizado, runRefreshableAction]);

  const manejarAccionDocumentoConLegal = useCallback(
    async (id, accion, extraData = {}) => {
      if (flujoFinalizado) return false;

      if (accion === "firmar") {
        if (!acceptedLegalSign) {
          setSignError(
            "Debes aceptar el aviso legal de firma electrónica antes de firmar."
          );
          return false;
        }
        setSignError("");
      }

      if (accion === "visar") {
        if (!acceptedLegalVisado) {
          setVisadoError(
            "Debes aceptar el aviso legal de visado antes de aprobar el documento."
          );
          return false;
        }
        setVisadoError("");
      }

      const ok = await manejarAccionDocumento(id, accion, extraData);

      if (ok) {
        setAcceptedLegalSign(false);
        setAcceptedLegalVisado(false);
        setSignError("");
        setVisadoError("");

        if (currentDocId) {
          await refreshAll(currentDocId);
        }
      }

      return ok;
    },
    [
      acceptedLegalSign,
      acceptedLegalVisado,
      flujoFinalizado,
      manejarAccionDocumento,
      currentDocId,
      refreshAll,
    ]
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
            Revisión de documento ({numeroInternoDisplay}) · Estado{" "}
            {currentStatus || "Sin estado"}
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
                    <span
                      className="detail-meta-value detail-meta-value--code"
                      title={numeroInternoDisplay}
                    >
                      {numeroInternoDisplay}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">
                      {clasificacionFieldLabel}:
                    </span>{" "}
                    <span
                      className="detail-meta-value"
                      title={clasificacionLabel}
                    >
                      {clasificacionLabel}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">
                      Condición notarial:
                    </span>{" "}
                    <span className="detail-meta-value" title={tramiteLabel}>
                      {tramiteLabel}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">Tipo de documento:</span>{" "}
                    <span
                      className="detail-meta-value"
                      title={documentoLabel}
                    >
                      {documentoLabel}
                    </span>
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

            {mergedDoc.description ? (
              <div className="detail-description">
                <strong>Descripción:</strong> {mergedDoc.description}
              </div>
            ) : null}

            {isRejected && mergedDoc.reject_reason ? (
              <div className="detail-reject-box">
                <strong>Motivo de rechazo:</strong> {mergedDoc.reject_reason}
              </div>
            ) : null}

            <PdfViewerPanel
              currentDocId={currentDocId}
              pdfUrl={pdfUrl}
              loadingPdf={loadingPdf}
              pdfError={pdfError}
              downloadUrl={downloadUrl}
              mostrarBotonRecordatorio={mostrarBotonRecordatorio}
              mostrarBotonReenvioVisado={mostrarBotonReenvioVisado}
              recordatorioLoading={recordatorioLoading}
              reenviarLoadingVisado={reenviarLoadingVisado}
              onEnviarRecordatorioATodos={handleEnviarRecordatorioATodos}
              onReenviarVisado={handleReenviarVisado}
            />

            <LegalValidationSection
              puedeFirmar={puedeFirmar}
              puedeVisar={puedeVisar}
              isSigned={isSigned}
              isRejected={isRejected}
              acceptedLegalSign={acceptedLegalSign}
              acceptedLegalVisado={acceptedLegalVisado}
              signError={signError}
              visadoError={visadoError}
              setAcceptedLegalSign={setAcceptedLegalSign}
              setAcceptedLegalVisado={setAcceptedLegalVisado}
              setSignError={setSignError}
              setVisadoError={setVisadoError}
            />

            <DetailSection
              title="Flujo de participantes"
              subtitle="Revisa el orden del proceso, el rol de cada participante y quién sigue en el flujo secuencial."
            >
              {loadingParticipants || loadingSigners ? (
                <p
                  className="detail-signers-loading"
                  role="status"
                  aria-live="polite"
                >
                  Cargando flujo de participantes...
                </p>
              ) : flowParticipants.length === 0 ? (
                <p className="detail-signers-empty">
                  No hay participantes registrados para este documento.
                </p>
              ) : (
                <>
                  <div className="detail-flow-summary">
                    <div className="detail-flow-summary__label">
                      {flujoFinalizado ? "Estado del flujo" : "Próximo paso"}
                    </div>
                    <div className="detail-flow-summary__value">
                      {flujoFinalizado ? (
                        isSigned ? (
                          "✅ Flujo completado"
                        ) : (
                          "❌ Flujo cerrado por rechazo"
                        )
                      ) : nextPendingParticipant ? (
                        `#${nextPendingParticipant.order} · ${nextPendingParticipant.roleLabel} · ${nextPendingParticipant.name}`
                      ) : (
                        "No hay participantes pendientes"
                      )}
                    </div>
                  </div>

                  <ul className="detail-flow-list">
                    {flowParticipants.map((participant) => {
                      const normalizedParticipantEmail = String(
                        participant.email || ""
                      ).toLowerCase();

                      const signerMatch = signers.find((signer) => {
                        const signerEmail = String(
                          signer?.email || ""
                        ).toLowerCase();

                        return (
                          String(signer?.id) === String(participant.id) ||
                          (normalizedParticipantEmail &&
                            signerEmail &&
                            signerEmail === normalizedParticipantEmail)
                        );
                      });

                      const signerId = signerMatch?.id;

                      const canRemind =
                        canManageDocumentReminders &&
                        participant.roleKey === FLOW_ROLE_KEYS.FIRMANTE &&
                        participant.statusKey === "pending" &&
                        Boolean(signerId) &&
                        !flujoFinalizado;

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
                                  {participant.email ||
                                    "Sin correo registrado"}
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
                                  Registrado el{" "}
                                  {formatDateTime(participant.signedAt)}
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
                              style={getButtonStateStyle(
                                reenviarSignerId === signerId
                              )}
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
            </DetailSection>

            <DetailSection
              title="Timeline del documento"
              subtitle="Consulta el avance general y distingue eventos automáticos de acciones realizadas por usuarios."
            >
              <div className="detail-timeline-wrapper">
                {loadingTimeline ? (
                  <div
                    className="detail-timeline-loading"
                    role="status"
                    aria-live="polite"
                  >
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
            </DetailSection>

            {canSeeActionHistory ? (
              <DetailSection
                title="Historial de acciones"
                subtitle="Registro detallado de eventos del documento para seguimiento y auditoría."
              >
                <div className="detail-history">
                  <EventList events={safeEvents} />
                </div>
              </DetailSection>
            ) : null}

            <DetailActions
              puedeFirmar={puedeFirmar}
              puedeVisar={puedeVisar}
              puedeRechazar={puedeRechazar}
              selectedDoc={mergedDoc}
              setView={setView}
              setSelectedDoc={setSelectedDoc}
              manejarAccionDocumento={manejarAccionDocumentoConLegal}
              canAdminDocumentActions={canSeeActionHistory}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
