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

function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeParticipantRole(value = "") {
  const role = String(value || "").trim().toLowerCase();

  if (role.includes("vis")) {
    return {
      key: "visador",
      label: "Visador",
      badgeClass: "detail-flow-badge detail-flow-badge--warning",
    };
  }

  if (role.includes("firma") || role.includes("sign")) {
    return {
      key: "firmante",
      label: "Firmante",
      badgeClass: "detail-flow-badge detail-flow-badge--info",
    };
  }

  if (role.includes("represent")) {
    return {
      key: "representante",
      label: "Representante",
      badgeClass: "detail-flow-badge detail-flow-badge--neutral",
    };
  }

  return {
    key: "participante",
    label: "Participante",
    badgeClass: "detail-flow-badge detail-flow-badge--neutral",
  };
}

function normalizeFlowStatus(value = "") {
  const status = String(value || "").trim().toUpperCase();

  if (status === "FIRMADO") {
    return {
      key: "done",
      label: "Firmado",
      className: "detail-flow-status detail-flow-status--success",
    };
  }

  if (status === "VISADO") {
    return {
      key: "done",
      label: "Visado",
      className: "detail-flow-status detail-flow-status--warning",
    };
  }

  if (status === "RECHAZADO") {
    return {
      key: "rejected",
      label: "Rechazado",
      className: "detail-flow-status detail-flow-status--danger",
    };
  }

  if (
    status === "PENDIENTE" ||
    status === "PENDIENTE_FIRMA" ||
    status === "PENDIENTE_VISADO"
  ) {
    return {
      key: "pending",
      label: "Pendiente",
      className: "detail-flow-status detail-flow-status--pending",
    };
  }

  return {
    key: "unknown",
    label: status || "Sin estado",
    className: "detail-flow-status detail-flow-status--neutral",
  };
}

function buildFlowParticipants(participants = [], signers = []) {
  const signerMap = new Map(
    (Array.isArray(signers) ? signers : []).map((signer) => [String(signer.id), signer])
  );

  return (Array.isArray(participants) ? participants : [])
    .slice()
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a?.flow_order)) ? Number(a.flow_order) : 9999;
      const bOrder = Number.isFinite(Number(b?.flow_order)) ? Number(b.flow_order) : 9999;
      return aOrder - bOrder;
    })
    .map((participant, index) => {
      const roleInfo = normalizeParticipantRole(participant?.role_in_doc);
      const statusInfo = normalizeFlowStatus(participant?.status);
      const signer = signerMap.get(String(participant?.signer_id || participant?.id));

      return {
        id: participant?.id || `${participant?.email || "participant"}-${index}`,
        order: Number.isFinite(Number(participant?.flow_order))
          ? Number(participant.flow_order)
          : index + 1,
        name: participant?.name || signer?.name || "Participante",
        email: participant?.email || signer?.email || "Sin correo",
        roleLabel: roleInfo.label,
        roleBadgeClass: roleInfo.badgeClass,
        roleKey: roleInfo.key,
        statusKey: statusInfo.key,
        statusLabel: statusInfo.label,
        statusClassName: statusInfo.className,
        signedAt: participant?.signed_at || signer?.signed_at || null,
      };
    });
}

function buildDocumentStateMeta(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === DOC_STATUS.FIRMADO) {
    return {
      label: "Firmado",
      className: "detail-doc-state detail-doc-state--success",
      helper: "El flujo del documento ya fue completado.",
    };
  }

  if (normalized === DOC_STATUS.RECHAZADO) {
    return {
      label: "Rechazado",
      className: "detail-doc-state detail-doc-state--danger",
      helper: "El documento fue rechazado y el flujo quedó cerrado.",
    };
  }

  if (normalized === DOC_STATUS.PENDIENTE_VISADO) {
    return {
      label: "Pendiente de visado",
      className: "detail-doc-state detail-doc-state--warning",
      helper: "Aún falta la aprobación o revisión previa antes de completar la firma.",
    };
  }

  if (normalized === DOC_STATUS.PENDIENTE_FIRMA) {
    return {
      label: "Pendiente de firma",
      className: "detail-doc-state detail-doc-state--info",
      helper: "El documento sigue esperando firmas pendientes.",
    };
  }

  return {
    label: normalized || "Sin estado",
    className: "detail-doc-state detail-doc-state--neutral",
    helper: "Estado actual del documento.",
  };
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

  const documentStateMeta = useMemo(
    () => buildDocumentStateMeta(selectedDoc?.status),
    [selectedDoc?.status]
  );

  const flowParticipants = useMemo(
    () => buildFlowParticipants(participants, signers),
    [participants, signers]
  );

  const nextPendingParticipant = useMemo(
    () => flowParticipants.find((p) => p.statusKey === "pending") || null,
    [flowParticipants]
  );

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
    [acceptedLegalSign, acceptedLegalVisado, manejarAccionDocumento]
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
            {numeroInterno ? `(${numeroInterno})` : `#${selectedDoc.id}`} · Estado{" "}
            {selectedDoc.status}
          </span>

          <span className="detail-topbar-user">
            Hola, <span>{displayName}</span>
          </span>
        </header>

        <div className="detail-container">
          <div className="detail-card">
            <div className="detail-header-block">
              <div>
                <h1 className="detail-title">
                  {selectedDoc.title || "Documento sin título"}
                </h1>

                <div className="detail-meta">
                  <p>
                    N° interno: <strong>{numeroInterno || `#${selectedDoc.id}`}</strong>
                  </p>
                  <p>
                    Tipo de trámite:{" "}
                    <strong>
                      {tramiteLabel} – {documentoLabel}
                    </strong>
                  </p>
                </div>
              </div>

              <div className={documentStateMeta.className}>
                <div className="detail-doc-state__label">{documentStateMeta.label}</div>
                <div className="detail-doc-state__helper">{documentStateMeta.helper}</div>
              </div>
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

            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Documento y acciones</h3>
                <p className="detail-section__subtitle">
                  Visualiza el PDF final, descarga el archivo o reenvía recordatorios según el estado actual.
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
            </section>

            {(puedeFirmar || puedeVisar) && !isSigned && !isRejected && (
              <section className="detail-section">
                <div className="detail-section__header">
                  <h3 className="detail-section__title">Validaciones previas</h3>
                  <p className="detail-section__subtitle">
                    Antes de firmar o visar, deja constancia de aceptación del aviso legal correspondiente.
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
                  Revisa el orden del proceso, el rol de cada participante y quién sigue en el flujo secuencial.
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
                      const canRemind =
                        participant.roleKey === "firmante" &&
                        participant.statusKey === "pending";

                      const signerMatch = signers.find(
                        (s) =>
                          String(s.id) === String(participant.id) ||
                          String(s.email || "").toLowerCase() ===
                            String(participant.email || "").toLowerCase()
                      );

                      const signerId = signerMatch?.id;

                      return (
                        <li key={participant.id} className="detail-flow-item">
                          <div className="detail-flow-item__order">
                            {participant.order}
                          </div>

                          <div className="detail-flow-item__body">
                            <div className="detail-flow-item__top">
                              <div>
                                <div className="detail-signer-main">
                                  {participant.name}
                                </div>
                                <div className="detail-signer-sub">
                                  {participant.email}
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

                          {canRemind && signerId && (
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
                          )}
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
                  Consulta el avance general y distingue eventos automáticos de acciones realizadas por usuarios.
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
                  Registro detallado de eventos del documento para seguimiento y auditoría.
                </p>
              </div>

              <div className="detail-history">
                {timeline?.events?.length > 0 ? (
                  <EventList events={timeline.events} />
                ) : (
                  <EventList events={safeEvents} />
                )}
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