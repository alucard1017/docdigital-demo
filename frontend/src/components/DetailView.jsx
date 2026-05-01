import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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

function DetailSection({ title, subtitle, children, actions = null }) {
  return (
    <section className="detail-section">
      <div className="detail-section__header">
        <div>
          <h3 className="detail-section__title">{title}</h3>
          {subtitle ? (
            <p className="detail-section__subtitle">{subtitle}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="detail-section__actions">{actions}</div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function PdfViewerPanel({
  t,
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
      title={t("detail.pdf.title", "Documento y acciones")}
      subtitle={t(
        "detail.pdf.subtitle",
        "Visualiza el PDF final, descarga el archivo o reenvía recordatorios según el estado actual."
      )}
      actions={
        <div className="detail-toolbar-actions">
          {mostrarBotonRecordatorio ? (
            <button
              type="button"
              className="btn-main detail-btn-reminder-all"
              onClick={onEnviarRecordatorioATodos}
              disabled={recordatorioLoading}
            >
              <Mail size={16} aria-hidden="true" />
              <span>
                {recordatorioLoading
                  ? t(
                      "detail.pdf.remindAllSending",
                      "Enviando recordatorio..."
                    )
                  : t("detail.pdf.remindAll", "Recordar a todos")}
              </span>
            </button>
          ) : null}

          {mostrarBotonReenvioVisado ? (
            <button
              type="button"
              className="btn-main detail-btn-reminder-visado"
              onClick={onReenviarVisado}
              disabled={reenviarLoadingVisado}
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span>
                {reenviarLoadingVisado
                  ? t("detail.pdf.resendVisaSending", "Reenviando visado...")
                  : t("detail.pdf.resendVisa", "Reenviar visado")}
              </span>
            </button>
          ) : null}

          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="btn-main detail-btn-download"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={16} aria-hidden="true" />
              <span>{t("detail.pdf.download", "Descargar PDF")}</span>
            </a>
          ) : null}

          {pdfUrl && !loadingPdf ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-main detail-btn-view"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>{t("detail.pdf.openNewTab", "Abrir en otra pestaña")}</span>
            </a>
          ) : null}
        </div>
      }
    >
      <div className="detail-pdf-toolbar">
        <span className="detail-toolbar-label">
          {t("detail.pdf.previewLabel", "Visualización del documento final")}
        </span>

        {currentDocId ? (
          <span className="detail-toolbar-docid">
            {t("detail.pdf.documentId", "Documento #{{id}}", {
              id: currentDocId,
            })}
          </span>
        ) : null}
      </div>

      <div className="detail-pdf-wrapper">
        {loadingPdf ? (
          <div className="detail-pdf-empty" role="status" aria-live="polite">
            {t("detail.pdf.loading", "Cargando vista previa del PDF...")}
          </div>
        ) : pdfUrl ? (
          <iframe
            title={t("detail.pdf.iframeTitle", "PDF del documento {{id}}", {
              id: currentDocId || "",
            })}
            src={pdfUrl}
            className="detail-pdf-iframe"
          />
        ) : (
          <div className="detail-pdf-empty" role="status" aria-live="polite">
            {pdfError ||
              t(
                "detail.pdf.error",
                "No se pudo cargar la vista previa del PDF. Usa \"Descargar PDF\" para ver el documento."
              )}
          </div>
        )}
      </div>
    </DetailSection>
  );
}

function LegalValidationSection({
  t,
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
      title={t("detail.legal.title", "Validaciones previas")}
      subtitle={t(
        "detail.legal.subtitle",
        "Antes de firmar o visar, deja constancia de aceptación del aviso legal correspondiente."
      )}
    >
      {puedeFirmar ? (
        <div className="detail-legal-block">
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
        </div>
      ) : null}

      {puedeVisar ? (
        <div className="detail-legal-block">
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
        </div>
      ) : null}
    </DetailSection>
  );
}

function ParticipantFlowSection({
  t,
  loadingParticipants,
  loadingSigners,
  flowParticipants,
  signers,
  flujoFinalizado,
  isSigned,
  canManageDocumentReminders,
  reenviarSignerId,
  onReenviarFirma,
}) {
  const nextPendingParticipant =
    flowParticipants.find((participant) => participant.statusKey === "pending") ||
    null;

  return (
    <DetailSection
      title={t("detail.flow.title", "Flujo de participantes")}
      subtitle={t(
        "detail.flow.subtitle",
        "Revisa el orden del proceso, el rol de cada participante y quién sigue en el flujo secuencial."
      )}
    >
      {loadingParticipants || loadingSigners ? (
        <p className="detail-signers-loading" role="status" aria-live="polite">
          {t("detail.flow.loading", "Cargando flujo de participantes...")}
        </p>
      ) : flowParticipants.length === 0 ? (
        <p className="detail-signers-empty">
          {t(
            "detail.flow.empty",
            "No hay participantes registrados para este documento."
          )}
        </p>
      ) : (
        <>
          <div className="detail-flow-summary">
            <div className="detail-flow-summary__label">
              {flujoFinalizado
                ? t("detail.flow.summaryLabelFinished", "Estado del flujo")
                : t("detail.flow.summaryLabelNext", "Próximo paso")}
            </div>

            <div className="detail-flow-summary__value">
              {flujoFinalizado ? (
                isSigned ? (
                  t("detail.flow.completed", "Flujo completado")
                ) : (
                  t("detail.flow.closedRejected", "Flujo cerrado por rechazo")
                )
              ) : nextPendingParticipant ? (
                t("detail.flow.nextParticipant", "#{{order}} · {{role}} · {{name}}", {
                  order: nextPendingParticipant.order,
                  role: nextPendingParticipant.roleLabel,
                  name: nextPendingParticipant.name,
                })
              ) : (
                t("detail.flow.noPending", "No hay participantes pendientes")
              )}
            </div>
          </div>

          <ul className="detail-flow-list">
            {flowParticipants.map((participant) => {
              const normalizedParticipantEmail = String(
                participant.email || ""
              ).toLowerCase();

              const signerMatch = signers.find((signer) => {
                const signerEmail = String(signer?.email || "").toLowerCase();

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

              const isSendingReminder = reenviarSignerId === signerId;

              return (
                <li key={participant.id} className="detail-flow-item">
                  <div className="detail-flow-item__order">{participant.order}</div>

                  <div className="detail-flow-item__body">
                    <div className="detail-flow-item__top">
                      <div>
                        <div className="detail-flow-item__name">
                          {participant.name}
                        </div>
                        <div className="detail-flow-item__email">
                          {participant.email ||
                            t("detail.flow.noEmail", "Sin correo registrado")}
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
                          {t("detail.flow.registeredAt", "Registrado el {{date}}", {
                            date: formatDateTime(participant.signedAt),
                          })}
                        </span>
                      ) : (
                        <span>
                          {t("detail.flow.noActionYet", "Aún no registra acción")}
                        </span>
                      )}
                    </div>
                  </div>

                  {canRemind ? (
                    <button
                      type="button"
                      className="btn-main detail-btn-inline-reminder"
                      onClick={() => onReenviarFirma(signerId)}
                      disabled={isSendingReminder}
                    >
                      <Mail size={14} aria-hidden="true" />
                      <span>
                        {isSendingReminder
                          ? t("detail.flow.sending", "Enviando...")
                          : t("detail.flow.remind", "Recordar")}
                      </span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
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
  const { t } = useTranslation();
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

  const canSeeActionHistory = canViewAuditLogs(currentUser);
  const canManageDocumentReminders = canManageReminders(currentUser);

  const currentTimelineDoc = timeline?.document || null;
  const currentDocId = selectedDoc?.id ?? currentTimelineDoc?.id ?? null;

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

  const numeroInternoDisplay = useMemo(() => {
    if (numeroInterno) return numeroInterno;
    if (currentDocId) {
      return t("detail.header.documentNumberShort", "#{{id}}", {
        id: currentDocId,
      });
    }
    return t("detail.common.notAvailable", "N/D");
  }, [numeroInterno, currentDocId, t]);

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
    () => getNotaryLabel(mergedDoc) || t("detail.common.notReported", "No informado"),
    [mergedDoc, t]
  );

  const documentoLabel = useMemo(
    () =>
      getDocumentKindLabel(mergedDoc) ||
      t("detail.common.notReported", "No informado"),
    [mergedDoc, t]
  );

  const currentStatus = useMemo(
    () => getNormalizedDocumentStatus(mergedDoc, timeline),
    [mergedDoc, timeline]
  );

  const isSigned = currentStatus === DOC_STATUS.FIRMADO;
  const isRejected = currentStatus === DOC_STATUS.RECHAZADO;
  const flujoFinalizado = isSigned || isRejected;

  const mostrarBotonReenvioVisado =
    canManageDocumentReminders &&
    shouldShowVisadoReminder(mergedDoc, currentStatus);

  const mostrarBotonRecordatorio =
    canManageDocumentReminders && shouldShowGlobalReminder(currentStatus);

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
      if (!docId) return null;

      try {
        setLoadingTimeline(true);
        setLoadingParticipants(true);

        const data = await getDocumentTimeline(docId);
        setTimeline(data || null);
        setParticipants(Array.isArray(data?.participants) ? data.participants : []);
        timelineToastShownRef.current = false;

        return data;
      } catch (err) {
        if (isAbortLikeError(err)) return null;

        console.error("Error fetching timeline/participants:", err);
        setTimeline(null);
        setParticipants([]);

        showErrorToastOnce(timelineToastShownRef, {
          type: "error",
          title: t("detail.toasts.timelineErrorTitle", "No se pudo cargar el flujo"),
          message: getErrorMessage(
            err,
            t(
              "detail.toasts.timelineErrorMessage",
              "No se pudo cargar la línea de tiempo del documento."
            )
          ),
        });

        return null;
      } finally {
        setLoadingTimeline(false);
        setLoadingParticipants(false);
      }
    },
    [showErrorToastOnce, t]
  );

  const refreshSigners = useCallback(
    async (docId, signal) => {
      if (!docId) return [];

      try {
        setLoadingSigners(true);

        const res = await api.get(`/documents/${docId}/signers`, { signal });
        const nextSigners = Array.isArray(res.data) ? res.data : [];

        setSigners(nextSigners);
        signersToastShownRef.current = false;

        return nextSigners;
      } catch (err) {
        if (isAbortLikeError(err)) return [];

        console.error("Error fetching signers:", err);
        setSigners([]);

        showErrorToastOnce(signersToastShownRef, {
          type: "error",
          title: t(
            "detail.toasts.signersErrorTitle",
            "No se pudieron cargar los firmantes"
          ),
          message: getErrorMessage(
            err,
            t(
              "detail.toasts.signersErrorMessage",
              "No se pudo cargar la lista de firmantes."
            )
          ),
        });

        return [];
      } finally {
        setLoadingSigners(false);
      }
    },
    [showErrorToastOnce, t]
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

    timelineToastShownRef.current = false;
    signersToastShownRef.current = false;

    const run = async () => {
      await refreshAll(docId, controller.signal);
    };

    run();

    const intervalId = window.setInterval(() => {
      if (controller.signal.aborted) return;
      refreshAll(docId, controller.signal);
    }, DETAIL_POLL_INTERVAL_MS);

    return () => {
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

        return true;
      } catch (err) {
        console.error(errorToast.logLabel, err);

        addToast({
          type: "error",
          title: errorToast.title,
          message: getErrorMessage(err, errorToast.message),
        });

        return false;
      } finally {
        if (typeof loadingSetter === "function") {
          loadingSetter(false);
        }
      }
    },
    [addToast, currentDocId, refreshAll]
  );

  const handleReenviarVisado = useCallback(async () => {
    if (!currentDocId || flujoFinalizado) return false;

    return runRefreshableAction({
      loadingSetter: setReenviarLoadingVisado,
      request: () =>
        api.post(`/documents/${currentDocId}/reenviar`, {
          tipo: REMINDER_TYPES.VISADO,
        }),
      successToast: {
        title: t("detail.toasts.visaResentTitle", "Visado reenviado"),
        message: t(
          "detail.toasts.visaResentMessage",
          "Recordatorio de visado reenviado correctamente."
        ),
      },
      errorToast: {
        title: t(
          "detail.toasts.visaResendErrorTitle",
          "No se pudo reenviar el visado"
        ),
        message: t(
          "detail.toasts.visaResendErrorMessage",
          "No se pudo reenviar el correo de visado."
        ),
        logLabel: "Error reenviando visado:",
      },
    });
  }, [currentDocId, flujoFinalizado, runRefreshableAction, t]);

  const handleReenviarFirma = useCallback(
    async (signerId) => {
      if (!currentDocId || !signerId || flujoFinalizado) return false;

      try {
        setReenviarSignerId(signerId);

        const res = await api.post(`/documents/${currentDocId}/reenviar`, {
          tipo: REMINDER_TYPES.FIRMA,
          signerId,
        });

        addToast({
          type: "success",
          title: t("detail.toasts.reminderSentTitle", "Recordatorio enviado"),
          message:
            res?.data?.message ||
            t(
              "detail.toasts.signatureReminderSentMessage",
              "Recordatorio de firma reenviado correctamente."
            ),
        });

        await refreshAll(currentDocId);
        return true;
      } catch (err) {
        console.error("Error reenviando firma:", err);

        addToast({
          type: "error",
          title: t(
            "detail.toasts.signatureResendErrorTitle",
            "No se pudo reenviar la firma"
          ),
          message: getErrorMessage(
            err,
            t(
              "detail.toasts.signatureResendErrorMessage",
              "No se pudo reenviar el correo de firma."
            )
          ),
        });

        return false;
      } finally {
        setReenviarSignerId(null);
      }
    },
    [currentDocId, flujoFinalizado, addToast, refreshAll, t]
  );

  const handleEnviarRecordatorioATodos = useCallback(async () => {
    if (!currentDocId || flujoFinalizado) return false;

    return runRefreshableAction({
      loadingSetter: setRecordatorioLoading,
      request: () => api.post(`/documents/${currentDocId}/recordatorio`),
      successToast: {
        title: t("detail.toasts.reminderSentTitle", "Recordatorio enviado"),
        message: t(
          "detail.toasts.reminderSentMessage",
          "Recordatorio enviado correctamente."
        ),
      },
      errorToast: {
        title: t(
          "detail.toasts.reminderErrorTitle",
          "No se pudo enviar el recordatorio"
        ),
        message: t(
          "detail.toasts.reminderErrorMessage",
          "No se pudo enviar el recordatorio."
        ),
        logLabel: "Error enviando recordatorio a todos:",
      },
    });
  }, [currentDocId, flujoFinalizado, runRefreshableAction, t]);

  const manejarAccionDocumentoConLegal = useCallback(
    async (id, accion, extraData = {}) => {
      if (flujoFinalizado) return false;

      if (accion === "firmar" && !acceptedLegalSign) {
        setSignError(
          t(
            "detail.legal.signRequired",
            "Debes aceptar el aviso legal de firma electrónica antes de firmar."
          )
        );
        return false;
      }

      if (accion === "visar" && !acceptedLegalVisado) {
        setVisadoError(
          t(
            "detail.legal.visaRequired",
            "Debes aceptar el aviso legal de visado antes de aprobar el documento."
          )
        );
        return false;
      }

      setSignError("");
      setVisadoError("");

      const ok = await manejarAccionDocumento(id, accion, extraData);

      if (!ok) return false;

      setAcceptedLegalSign(false);
      setAcceptedLegalVisado(false);
      setSignError("");
      setVisadoError("");

      if (currentDocId) {
        await refreshAll(currentDocId);
      }

      return true;
    },
    [
      acceptedLegalSign,
      acceptedLegalVisado,
      flujoFinalizado,
      manejarAccionDocumento,
      currentDocId,
      refreshAll,
      t,
    ]
  );

  if (!selectedDoc) return null;

  return (
    <div className="detail-layout">
      <aside className="detail-sidebar">
        <h2 className="detail-sidebar-header">
          {t("sidebar.brand", "VeriFirma")}
        </h2>

        <button
          type="button"
          className="detail-nav-item"
          onClick={handleBackToList}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t("detail.sidebar.back", "Volver a la bandeja")}</span>
        </button>

        <button
          type="button"
          className="detail-nav-item detail-sidebar-footer"
          onClick={logout}
        >
          <LogOut size={16} aria-hidden="true" />
          <span>{t("sidebar.logout", "Cerrar sesión")}</span>
        </button>
      </aside>

      <main className="detail-main-area">
        <header className="detail-topbar">
          <span className="detail-topbar-title">
            {t(
              "detail.header.reviewTitle",
              "Revisión de documento ({{number}}) · Estado {{status}}",
              {
                number: numeroInternoDisplay,
                status: currentStatus || t("documents.status.noStatus", "Sin estado"),
              }
            )}
          </span>

          <span className="detail-topbar-user">
            {t("detail.header.greeting", "Hola,")} <span>{displayName}</span>
          </span>
        </header>

        <div className="detail-container">
          <div className="detail-card">
            <div className="detail-header-block">
              <div className="detail-header-main">
                <h1 className="detail-title">{titleDocumento}</h1>

                <div className="detail-meta">
                  <p>
                    <span className="detail-meta-label">
                      {t("detail.meta.internalNumber", "N.° interno")}:
                    </span>{" "}
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
                    <span className="detail-meta-value" title={clasificacionLabel}>
                      {clasificacionLabel}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">
                      {t("detail.meta.notaryCondition", "Condición notarial")}:
                    </span>{" "}
                    <span className="detail-meta-value" title={tramiteLabel}>
                      {tramiteLabel}
                    </span>
                  </p>

                  <p>
                    <span className="detail-meta-label">
                      {t("detail.meta.documentType", "Tipo de documento")}:
                    </span>{" "}
                    <span className="detail-meta-value" title={documentoLabel}>
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
                <strong>{t("detail.meta.description", "Descripción")}:</strong>{" "}
                {mergedDoc.description}
              </div>
            ) : null}

            {isRejected && mergedDoc.reject_reason ? (
              <div className="detail-reject-box">
                <strong>{t("detail.meta.rejectReason", "Motivo de rechazo")}:</strong>{" "}
                {mergedDoc.reject_reason}
              </div>
            ) : null}

            <PdfViewerPanel
              t={t}
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
              t={t}
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

            <ParticipantFlowSection
              t={t}
              loadingParticipants={loadingParticipants}
              loadingSigners={loadingSigners}
              flowParticipants={flowParticipants}
              signers={signers}
              flujoFinalizado={flujoFinalizado}
              isSigned={isSigned}
              canManageDocumentReminders={canManageDocumentReminders}
              reenviarSignerId={reenviarSignerId}
              onReenviarFirma={handleReenviarFirma}
            />

            <DetailSection
              title={t("detail.timeline.title", "Timeline del documento")}
              subtitle={t(
                "detail.timeline.subtitle",
                "Consulta el avance general y distingue eventos automáticos de acciones realizadas por usuarios."
              )}
            >
              <div className="detail-timeline-wrapper">
                {loadingTimeline ? (
                  <div
                    className="detail-timeline-loading"
                    role="status"
                    aria-live="polite"
                  >
                    {t("detail.timeline.loading", "Cargando progreso...")}
                  </div>
                ) : timeline ? (
                  <Timeline timeline={timeline} />
                ) : (
                  <div className="detail-timeline-empty">
                    {t(
                      "detail.timeline.empty",
                      "No hay datos de progreso disponibles."
                    )}
                  </div>
                )}
              </div>
            </DetailSection>

            {canSeeActionHistory ? (
              <DetailSection
                title={t("detail.history.title", "Historial de acciones")}
                subtitle={t(
                  "detail.history.subtitle",
                  "Registro detallado de eventos del documento para seguimiento y auditoría."
                )}
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

export default DetailView;