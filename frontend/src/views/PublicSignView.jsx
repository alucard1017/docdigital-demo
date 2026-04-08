import React, { useMemo, useState, useCallback, useEffect } from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";
import { PublicPdfViewer } from "../components/PublicPdfViewer";

function stripTrailingSlashes(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizePublicApiBase(API_URL) {
  const raw = API_URL || import.meta.env.VITE_API_URL || "";
  const trimmed = stripTrailingSlashes(raw);
  if (!trimmed) return "";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toUpperCase();
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function sanitizePublicMessage(message, fallback) {
  const raw = String(message || "").trim();
  if (!raw) return fallback;

  const lowered = raw.toLowerCase();

  if (
    lowered.includes("jwt") ||
    lowered.includes("stack") ||
    lowered.includes("sql") ||
    lowered.includes("sequelize") ||
    lowered.includes("postgres") ||
    lowered.includes("token malformed") ||
    lowered.includes("internal server error")
  ) {
    return fallback;
  }

  return raw;
}

function classifyPublicError(error) {
  const text = String(error || "").toLowerCase();

  if (!text) {
    return {
      kind: "generic-error",
      title: "No se pudo abrir el documento",
      message:
        "Ocurrió un problema al cargar este enlace. Intenta nuevamente en unos segundos.",
      canRetry: true,
    };
  }

  if (text.includes("expir") || text.includes("expired")) {
    return {
      kind: "expired",
      title: "Este enlace venció",
      message:
        "Este enlace ya no está disponible. Solicita un nuevo enlace a la empresa que te envió el documento.",
      canRetry: false,
    };
  }

  if (
    text.includes("used") ||
    text.includes("already used") ||
    text.includes("ya fue usado") ||
    text.includes("ya fue firmado") ||
    text.includes("ya fue rechazado")
  ) {
    return {
      kind: "used",
      title: "Este enlace ya no requiere acción",
      message:
        "Este enlace ya fue utilizado anteriormente y no admite una nueva acción.",
      canRetry: false,
    };
  }

  if (
    text.includes("token") ||
    text.includes("inválido") ||
    text.includes("invalido") ||
    text.includes("invalid")
  ) {
    return {
      kind: "invalid",
      title: "Este enlace no es válido",
      message:
        "No pudimos validar este acceso. Abre el enlace completo desde tu correo o solicita uno nuevo.",
      canRetry: false,
    };
  }

  return {
    kind: "generic-error",
    title: "No se pudo abrir el documento",
    message:
      "Ocurrió un problema al cargar este enlace. Intenta nuevamente en unos segundos.",
    canRetry: true,
  };
}

function resolvePublicState({
  publicSignError,
  document,
  documentStatus,
  signerStatus,
  isVisado,
}) {
  if (publicSignError) {
    return classifyPublicError(publicSignError);
  }

  if (!document) {
    return {
      kind: "loading",
      title: "",
      message: "",
      canRetry: false,
    };
  }

  const signerAlreadyDone = !isVisado && signerStatus === "FIRMADO";
  const documentCompleted = !isVisado && documentStatus === "FIRMADO";
  const documentRejected = documentStatus === "RECHAZADO";
  const visadoDone =
    isVisado &&
    documentStatus &&
    documentStatus !== "PENDIENTE_VISADO" &&
    documentStatus !== "PENDIENTE";

  if (documentRejected) {
    return {
      kind: "rejected",
      title: "Este documento fue rechazado",
      message: "El flujo quedó cerrado y este enlace ya no admite acciones.",
      canRetry: false,
    };
  }

  if (documentCompleted) {
    return {
      kind: "completed",
      title: "Este documento ya fue firmado",
      message:
        "El proceso ya fue completado y no puedes realizar nuevas acciones desde este enlace.",
      canRetry: false,
    };
  }

  if (signerAlreadyDone) {
    return {
      kind: "used",
      title: "Tu firma ya fue registrada",
      message:
        "Este enlace ya fue usado anteriormente y no requiere una nueva acción.",
      canRetry: false,
    };
  }

  if (visadoDone) {
    return {
      kind: "used",
      title: "El visado ya fue registrado",
      message:
        "La revisión del documento ya fue procesada y este enlace no requiere otra acción.",
      canRetry: false,
    };
  }

  return {
    kind: "pending",
    title: isVisado ? "Pendiente de visado" : "Pendiente de firma",
    message: isVisado
      ? "Revisa el documento y registra tu visado cuando estés listo."
      : "Revisa el documento y registra tu firma cuando estés listo.",
    canRetry: false,
  };
}

function getStatusBadge(state, isVisado) {
  switch (state.kind) {
    case "completed":
      return {
        label: "Completado",
        className: "public-sign-status public-sign-status--success",
      };
    case "used":
      return {
        label: "Sin acción",
        className: "public-sign-status public-sign-status--warning",
      };
    case "rejected":
    case "expired":
    case "invalid":
    case "generic-error":
      return {
        label:
          state.kind === "expired"
            ? "Enlace vencido"
            : state.kind === "invalid"
            ? "Enlace inválido"
            : state.kind === "rejected"
            ? "Rechazado"
            : "Error",
        className: "public-sign-status public-sign-status--danger",
      };
    default:
      return {
        label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
        className: isVisado
          ? "public-sign-status public-sign-status--warning"
          : "public-sign-status public-sign-status--info",
      };
  }
}

function buildActionSuccessMessage(isVisado, responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    isVisado
      ? "Visado registrado correctamente."
      : "Firma registrada correctamente."
  );
}

function buildActionErrorMessage(isVisado, responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    isVisado
      ? "No se pudo registrar el visado. Intenta nuevamente."
      : "No se pudo registrar la firma. Intenta nuevamente."
  );
}

function buildRejectErrorMessage(responseMessage) {
  return sanitizePublicMessage(
    responseMessage,
    "No se pudo registrar el rechazo. Intenta nuevamente."
  );
}

function getTramiteLabel(value) {
  const v = normalizeText(value);
  if (!v) return "";
  if (v.includes("notaria") || v.includes("notaría")) return "Con notaría";
  if (v.includes("sin notaria") || v.includes("sin notaría")) {
    return "Sin notaría";
  }
  if (v === "propio") return "Propio";
  return String(value || "").trim();
}

function getDocumentoLabel(value) {
  const v = normalizeText(value);
  if (!v) return "";
  if (v === "poder" || v === "poderes") return "Poder";
  if (v === "contrato" || v === "contratos") return "Contrato";
  if (v === "autorizacion" || v === "autorización" || v === "autorizaciones") {
    return "Autorización";
  }
  return String(value || "").trim();
}

function buildTipoLabel(tipoTramite, tipoDocumento) {
  const tramite = getTramiteLabel(tipoTramite);
  const documento = getDocumentoLabel(tipoDocumento);

  if (tramite && documento) return `${tramite} · ${documento}`;
  if (documento) return documento;
  if (tramite) return tramite;
  return "General";
}

function resolveSignerRoleLabel(signer, isVisado) {
  const rawRole = normalizeText(
    signer?.role || signer?.rol || signer?.signer_role || signer?.participant_role
  );

  if (rawRole.includes("vis")) return "Visador";
  if (rawRole.includes("firm")) return "Firmante";
  if (rawRole.includes("revi")) return "Revisor";
  if (rawRole.includes("owner") || rawRole.includes("prop")) return "Propietario";

  return isVisado ? "Visador" : "Firmante";
}

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,
  publicSignPdfUrl,
  publicSignToken,
  publicSignMode,
  API_URL,
  cargarFirmaPublica,
}) {
  const API_BASE = useMemo(() => normalizePublicApiBase(API_URL), [API_URL]);
  const isVisado = publicSignMode === "visado";

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [signing, setSigning] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionMessageType, setActionMessageType] = useState("info");

  const document = useMemo(
    () => publicSignDoc?.document || publicSignDoc || null,
    [publicSignDoc]
  );

  const documentMeta = useMemo(() => {
    return (
      document?.metadata ||
      document?.meta ||
      document?.document_metadata ||
      publicSignDoc?.metadata ||
      publicSignDoc?.meta ||
      {}
    );
  }, [document, publicSignDoc]);

  const signedDocument = useMemo(() => {
    return (
      publicSignDoc?.signedDocument ||
      publicSignDoc?.signed_document ||
      publicSignDoc?.documento_firmado ||
      null
    );
  }, [publicSignDoc]);

  const signer = useMemo(() => {
    return (
      publicSignDoc?.signer ||
      publicSignDoc?.currentSigner ||
      (Array.isArray(publicSignDoc?.signers) ? publicSignDoc.signers[0] : null) ||
      null
    );
  }, [publicSignDoc]);

  const pdfUrl = useMemo(() => {
    return pickFirstNonEmpty(
      publicSignPdfUrl,
      publicSignDoc?.pdfUrl,
      publicSignDoc?.previewUrl,
      publicSignDoc?.signedPdfUrl,
      document?.signedPdfUrl,
      document?.previewUrl,
      document?.pdf_final_url,
      document?.pdf_url,
      document?.archivo_url,
      document?.file_url,
      signedDocument?.pdfUrl,
      signedDocument?.pdf_url,
      signedDocument?.archivo_url
    );
  }, [publicSignPdfUrl, publicSignDoc, document, signedDocument]);

  const documentTitle = useMemo(() => {
    return pickFirstNonEmpty(
      document?.title,
      document?.titulo,
      document?.document_title,
      document?.nombre,
      document?.name,
      signedDocument?.title,
      signedDocument?.titulo,
      "Documento"
    );
  }, [document, signedDocument]);

  const companyName = useMemo(() => {
    return pickFirstNonEmpty(
      document?.destinatario_nombre,
      document?.empresa_nombre,
      document?.nombre_empresa,
      document?.company_name,
      document?.companyName,
      document?.razon_social,
      document?.empresa,
      documentMeta?.destinatario_nombre,
      documentMeta?.empresa_nombre,
      documentMeta?.nombre_empresa,
      documentMeta?.company_name,
      documentMeta?.companyName,
      documentMeta?.razon_social,
      documentMeta?.empresa,
      signedDocument?.destinatario_nombre,
      signedDocument?.empresa_nombre,
      signedDocument?.nombre_empresa,
      signedDocument?.razon_social,
      publicSignDoc?.destinatario_nombre,
      publicSignDoc?.empresa_nombre,
      publicSignDoc?.nombre_empresa,
      publicSignDoc?.company_name,
      publicSignDoc?.companyName,
      publicSignDoc?.razon_social,
      "No informado"
    );
  }, [document, documentMeta, signedDocument, publicSignDoc]);

  const companyRut = useMemo(() => {
    return pickFirstNonEmpty(
      document?.empresa_rut,
      document?.rut_empresa,
      document?.company_rut,
      document?.companyRut,
      document?.rut,
      documentMeta?.empresa_rut,
      documentMeta?.rut_empresa,
      documentMeta?.company_rut,
      documentMeta?.companyRut,
      documentMeta?.rut,
      signedDocument?.empresa_rut,
      signedDocument?.rut_empresa,
      signedDocument?.rut,
      publicSignDoc?.empresa_rut,
      publicSignDoc?.rut_empresa,
      publicSignDoc?.company_rut,
      publicSignDoc?.companyRut,
      publicSignDoc?.rut,
      "No informado"
    );
  }, [document, documentMeta, signedDocument, publicSignDoc]);

  const contractNumber = useMemo(() => {
    return pickFirstNonEmpty(
      document?.numero_contrato_interno,
      document?.numero_contrato,
      document?.numeroContrato,
      document?.contract_number,
      document?.n_contrato,
      documentMeta?.numeroContratoInterno,
      documentMeta?.numero_contrato_interno,
      documentMeta?.numero_contrato,
      documentMeta?.numeroContrato,
      documentMeta?.contract_number,
      signedDocument?.numero_contrato_interno,
      signedDocument?.numero_contrato,
      signedDocument?.contract_number,
      publicSignDoc?.numero_contrato_interno,
      publicSignDoc?.numero_contrato,
      publicSignDoc?.contract_number,
      "Sin número"
    );
  }, [document, documentMeta, signedDocument, publicSignDoc]);

  const tipoDocumentoLabel = useMemo(() => {
    return buildTipoLabel(
      pickFirstNonEmpty(
        document?.tipo_tramite,
        document?.tramite_tipo,
        document?.tipoTramite,
        documentMeta?.tipo_tramite,
        documentMeta?.tramite_tipo,
        documentMeta?.tipoTramite,
        signedDocument?.tipo_tramite,
        publicSignDoc?.tipo_tramite
      ),
      pickFirstNonEmpty(
        document?.tipo_documento,
        document?.document_type,
        document?.tipoDocumento,
        documentMeta?.tipo_documento,
        documentMeta?.document_type,
        documentMeta?.tipoDocumento,
        signedDocument?.tipo_documento,
        publicSignDoc?.tipo_documento
      )
    );
  }, [document, documentMeta, signedDocument, publicSignDoc]);

  const signerName = useMemo(() => {
    return pickFirstNonEmpty(
      signer?.name,
      signer?.nombre,
      signer?.signer_name,
      signer?.full_name,
      signer?.fullname,
      isVisado ? "Visador" : "Firmante"
    );
  }, [signer, isVisado]);

  const signerEmail = useMemo(() => {
    return pickFirstNonEmpty(
      signer?.email,
      signer?.signer_email,
      signer?.correo,
      signer?.mail,
      "Sin correo disponible"
    );
  }, [signer]);

  const signerRoleLabel = useMemo(
    () => resolveSignerRoleLabel(signer, isVisado),
    [signer, isVisado]
  );

  const signerStatus = normalizeStatus(
    signer?.status || signer?.signer_status || signer?.estado
  );

  const documentStatus = normalizeStatus(
    document?.status ||
      document?.document_status ||
      document?.estado ||
      signedDocument?.status ||
      signedDocument?.estado
  );

  const flowState = useMemo(
    () =>
      resolvePublicState({
        publicSignError,
        document,
        documentStatus,
        signerStatus,
        isVisado,
      }),
    [publicSignError, document, documentStatus, signerStatus, isVisado]
  );

  const statusBadge = useMemo(
    () => getStatusBadge(flowState, isVisado),
    [flowState, isVisado]
  );

  const canActOnDocument =
    flowState.kind === "pending" &&
    !!document &&
    !!publicSignToken &&
    !!API_BASE &&
    !publicSignLoading;

  const showSkeleton = publicSignLoading && !document && !publicSignError;
  const titleText = isVisado ? "Visado de documento" : "Firma electrónica";

  useEffect(() => {
    if (!canActOnDocument) {
      setShowReject(false);
      setRejectReason("");
      setRejectError("");
      setLegalError("");
    }
  }, [canActOnDocument]);

  const handleRetryLoad = useCallback(() => {
    if (!publicSignToken || typeof cargarFirmaPublica !== "function") return;
    cargarFirmaPublica(publicSignToken);
  }, [cargarFirmaPublica, publicSignToken]);

  const handleConfirm = useCallback(async () => {
    if (signing || rejecting || !canActOnDocument) return;

    if (!acceptedLegal) {
      setLegalError(
        isVisado
          ? "Debes aceptar el aviso legal antes de registrar el visado."
          : "Debes aceptar el aviso legal antes de registrar la firma."
      );
      return;
    }

    try {
      setActionMessage("");
      setActionMessageType("info");
      setLegalError("");
      setSigning(true);

      const actionPath = isVisado ? "visar" : "firmar";
      const endpoint = `${API_BASE}/public/docs/${publicSignToken}/${actionPath}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(buildActionErrorMessage(isVisado, data?.message));
      }

      await cargarFirmaPublica(publicSignToken);

      setActionMessage(buildActionSuccessMessage(isVisado, data?.message));
      setActionMessageType("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setActionMessage(buildActionErrorMessage(isVisado, err?.message));
      setActionMessageType("error");
    } finally {
      setSigning(false);
    }
  }, [
    signing,
    rejecting,
    canActOnDocument,
    acceptedLegal,
    isVisado,
    API_BASE,
    publicSignToken,
    cargarFirmaPublica,
  ]);

  const handleReject = useCallback(async () => {
    if (rejecting || signing || !canActOnDocument) return;

    const motivo = String(rejectReason || "").trim();

    if (!motivo) {
      setRejectError("Debes ingresar un motivo de rechazo.");
      return;
    }

    try {
      setRejectError("");
      setActionMessage("");
      setActionMessageType("info");
      setRejecting(true);

      const res = await fetch(
        `${API_BASE}/public/docs/${publicSignToken}/rechazar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        }
      );

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(buildRejectErrorMessage(data?.message));
      }

      await cargarFirmaPublica(publicSignToken);

      setActionMessage(
        sanitizePublicMessage(
          data?.message,
          "Documento rechazado correctamente."
        )
      );
      setActionMessageType("success");
      setShowReject(false);
      setRejectReason("");
      setRejectError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setRejectError(buildRejectErrorMessage(err?.message));
    } finally {
      setRejecting(false);
    }
  }, [
    rejecting,
    signing,
    canActOnDocument,
    rejectReason,
    API_BASE,
    publicSignToken,
    cargarFirmaPublica,
  ]);

  const handleToggleReject = useCallback(() => {
    setShowReject((prev) => !prev);
    setRejectReason("");
    setRejectError("");
  }, []);

  const showPassiveStateCard =
    !canActOnDocument &&
    document &&
    !publicSignLoading &&
    flowState.kind !== "pending";

  const ActionBlock = canActOnDocument ? (
    <div className="public-sign-action-block">
      <ElectronicSignatureNotice
        mode={isVisado ? "visado" : "firma"}
        checked={acceptedLegal}
        onChange={(value) => {
          setAcceptedLegal(value);
          if (value) setLegalError("");
        }}
      />

      {legalError && (
        <div className="public-sign-inline-error">{legalError}</div>
      )}

      <p className="public-sign-helper-text">
        Al continuar, registrarás tu{" "}
        {isVisado ? "visado" : "firma electrónica"}. Esta acción no se puede
        deshacer.
      </p>

      {!showReject && (
        <div className="public-sign-actions">
          <button
            type="button"
            className={`public-sign-button public-sign-button--primary ${
              isVisado
                ? "public-sign-button--warning"
                : "public-sign-button--info"
            }`}
            onClick={handleConfirm}
            disabled={signing || rejecting || !acceptedLegal}
          >
            {signing
              ? "Procesando..."
              : isVisado
              ? "Registrar visado"
              : "Registrar firma"}
          </button>

          {!isVisado && (
            <button
              type="button"
              className="public-sign-button public-sign-button--danger"
              onClick={handleToggleReject}
              disabled={signing || rejecting}
            >
              Rechazar documento
            </button>
          )}
        </div>
      )}

      {showReject && (
        <div className="public-sign-reject-card">
          <h2 className="public-sign-reject-card__title">
            Rechazar documento
          </h2>

          <p className="public-sign-reject-card__text">
            Explica brevemente el motivo. Esta información puede compartirse con
            la empresa que te envió el documento.
          </p>

          <textarea
            rows={5}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="public-sign-textarea"
            placeholder="Escribe aquí el motivo del rechazo..."
            disabled={rejecting}
            aria-invalid={rejectError ? "true" : "false"}
            aria-describedby={
              rejectError ? "public-sign-reject-error" : undefined
            }
          />

          {rejectError && (
            <div
              id="public-sign-reject-error"
              className="public-sign-inline-error"
            >
              {rejectError}
            </div>
          )}

          <div className="public-sign-reject-actions">
            <button
              type="button"
              className="public-sign-button public-sign-button--secondary"
              onClick={handleToggleReject}
              disabled={rejecting}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="public-sign-button public-sign-button--danger-solid"
              onClick={handleReject}
              disabled={rejecting || signing}
            >
              {rejecting ? "Enviando..." : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  const messageCardClassName = `public-sign-message-card ${
    actionMessageType === "error"
      ? "public-sign-message-card--error"
      : actionMessageType === "success"
      ? "public-sign-message-card--success"
      : ""
  }`;

  return (
    <div className="public-sign-page">
      <div className="public-sign-shell">
        <PublicHeader />

        <header className="public-sign-heading">
          <div>
            <div className="public-sign-eyebrow">VeriFirma · Portal público</div>
            <h1 className="public-sign-title">{titleText}</h1>
          </div>
          <div className={statusBadge.className}>{statusBadge.label}</div>
        </header>

        <section
          className={`public-sign-intro ${
            isVisado ? "public-sign-intro--warning" : "public-sign-intro--info"
          }`}
        >
          <div
            className={`public-sign-intro__title ${
              isVisado
                ? "public-sign-intro__title--warning"
                : "public-sign-intro__title--info"
            }`}
          >
            {flowState.kind === "pending"
              ? isVisado
                ? "Revisa este documento para registrar tu visado"
                : "Revisa este documento para registrar tu firma"
              : flowState.title}
          </div>

          <div className="public-sign-intro__text">{flowState.message}</div>
        </section>

        {actionMessage && (
          <div className={messageCardClassName}>
            <div className="public-sign-message-card__text">{actionMessage}</div>
          </div>
        )}

        {showSkeleton && (
          <div className="public-sign-message-card">
            <div className="spinner public-sign-spinner" />
            <div className="public-sign-message-card__title">
              Cargando documento…
            </div>
            <div className="public-sign-message-card__text">
              Estamos preparando la vista para que puedas revisarlo.
            </div>
          </div>
        )}

        {publicSignError && (
          <div className="public-sign-message-card public-sign-message-card--error">
            <div className="public-sign-message-card__title">
              {flowState.title}
            </div>
            <div className="public-sign-message-card__text">
              {flowState.message}
            </div>

            {flowState.canRetry && (
              <button
                type="button"
                className="public-sign-button public-sign-button--secondary public-sign-button--auto"
                onClick={handleRetryLoad}
                disabled={publicSignLoading}
              >
                Reintentar carga
              </button>
            )}
          </div>
        )}

        {document && !publicSignLoading && !publicSignError && (
          <div className="public-sign-layout">
            <aside className="public-sign-sidebar">
              <div className="public-sign-summary">
                <div className="public-sign-section-label">Resumen</div>
                <div className="public-sign-summary__title">{documentTitle}</div>
                <div className="public-sign-summary__text">
                  Revisa la información principal antes de abrir el documento completo.
                </div>
              </div>

              <div className="public-sign-meta-grid">
                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">Empresa</div>
                  <div className="public-sign-meta-card__value">{companyName}</div>
                  <div className="public-sign-meta-card__subvalue">
                    RUT: {companyRut}
                  </div>
                </div>

                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">
                    Número de contrato
                  </div>
                  <div className="public-sign-meta-card__value public-sign-meta-card__value--contract">
                    {contractNumber}
                  </div>
                </div>

                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">
                    Tipo de trámite
                  </div>
                  <div className="public-sign-meta-card__value">
                    {tipoDocumentoLabel}
                  </div>
                </div>

                {signer && (
                  <div className="public-sign-meta-card">
                    <div className="public-sign-meta-card__label">
                      {isVisado ? "Revisando como" : "Firmando como"}
                    </div>
                    <div className="public-sign-meta-card__value">{signerName}</div>
                    <div className="public-sign-meta-card__subvalue">
                      {signerRoleLabel} · {signerEmail}
                    </div>
                  </div>
                )}
              </div>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-sign-open-pdf public-sign-open-pdf--fullwidth"
                >
                  Abrir documento completo
                </a>
              )}

              {showPassiveStateCard && (
                <div className="public-sign-message-card public-sign-message-card--info">
                  <div className="public-sign-message-card__title">
                    {flowState.title}
                  </div>
                  <div className="public-sign-message-card__text">
                    {flowState.message}
                  </div>
                </div>
              )}

              <div className="public-sign-desktop-actions">
                {ActionBlock}
              </div>
            </aside>

            <section className="public-sign-document-panel">
              <div className="public-sign-document-panel__header">
                <div>
                  <div className="public-sign-section-label">Documento</div>
                  <div className="public-sign-document-title">{documentTitle}</div>
                </div>
              </div>

              <div className="public-sign-pdf-stage">
                {pdfUrl ? (
                  <PublicPdfViewer fileUrl={pdfUrl} />
                ) : (
                  <div className="public-sign-pdf-empty">
                    No hay una vista previa disponible en este momento. Puedes
                    abrir el documento completo en una nueva pestaña si el enlace
                    está habilitado.
                  </div>
                )}
              </div>

              <div className="public-sign-mobile-actions">{ActionBlock}</div>
            </section>
          </div>
        )}

        <div className="public-sign-footer-wrap">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}