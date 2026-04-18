import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";
import { PublicPdfViewer } from "../components/PublicPdfViewer";
import {
  getProcedureFieldLabel,
  getProcedureLabel,
} from "../utils/documentLabels";

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

async function fetchJsonSafe(url, options = {}) {
  const res = await fetch(url, options);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `La solicitud falló con estado ${res.status}`;
    throw new Error(message);
  }

  return data;
}

function classifyPublicError(error) {
  const text = String(error || "").toLowerCase();

  if (!text) {
    return {
      kind: "error",
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
    text.includes("ya fue rechazado") ||
    text.includes("ya no requiere acción") ||
    text.includes("ya no admite acciones")
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
    text.includes("invalid") ||
    text.includes("no encontrado")
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
    kind: "error",
    title: "No se pudo abrir el documento",
    message:
      "Ocurrió un problema al cargar este enlace. Intenta nuevamente en unos segundos.",
      canRetry: true,
  };
}

function resolveSignerRoleLabel(signer, isVisado) {
  const rawRole = normalizeText(
    signer?.role ||
      signer?.rol ||
      signer?.signer_role ||
      signer?.participant_role
  );

  if (rawRole.includes("vis")) return "Visador";
  if (rawRole.includes("firmante_final")) return "Firmante final";
  if (rawRole.includes("final")) return "Firmante final";
  if (rawRole.includes("firm")) return "Firmante";
  if (rawRole.includes("revi")) return "Revisor";
  if (rawRole.includes("owner") || rawRole.includes("prop")) return "Propietario";

  return isVisado ? "Visador" : "Firmante";
}

function buildMetaTitle(label, value, extra = "") {
  const main = String(value || "").trim();
  const secondary = String(extra || "").trim();

  if (main && secondary) return `${label}: ${main} · ${secondary}`;
  if (main) return `${label}: ${main}`;
  return label;
}

function getReadableParticipantLabel({ signer, isVisado, document }) {
  const roleLabel = resolveSignerRoleLabel(signer, isVisado);

  const signerName = pickFirstNonEmpty(
    signer?.name,
    signer?.nombre,
    signer?.signer_name,
    signer?.full_name,
    signer?.fullname
  );

  const signerEmail = pickFirstNonEmpty(
    signer?.email,
    signer?.signer_email,
    signer?.correo,
    signer?.mail
  );

  if (signerName && signerEmail) {
    return {
      title: isVisado ? "Revisando como" : "Firmando como",
      primary: signerName,
      secondary: `${roleLabel} · ${signerEmail}`,
    };
  }

  if (signerName) {
    return {
      title: isVisado ? "Revisando como" : "Firmando como",
      primary: signerName,
      secondary: roleLabel,
    };
  }

  const fallbackName = isVisado
    ? pickFirstNonEmpty(document?.visador_nombre, "Visador")
    : pickFirstNonEmpty(document?.firmante_nombre, "Firmante");

  return {
    title: isVisado ? "Revisando como" : "Firmando como",
    primary: fallbackName,
    secondary: roleLabel,
  };
}

function buildActionEndpoint({ apiBase, token, isVisado }) {
  const encoded = encodeURIComponent(token);

  return isVisado
    ? `${apiBase}/public/docs/document/${encoded}/visar`
    : `${apiBase}/public/docs/${encoded}/firmar`;
}

function buildRejectEndpoint({ apiBase, token, tokenKind }) {
  const encoded = encodeURIComponent(token);

  if (tokenKind !== "signer") {
    throw new Error(
      "El rechazo público solo está disponible para enlaces de firmante."
    );
  }

  return `${apiBase}/public/docs/${encoded}/rechazar`;
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

function resolveViewState({
  hasToken,
  publicSignLoading,
  publicSignError,
  document,
  documentStatus,
  signerStatus,
  isVisado,
  requiresVisado,
}) {
  if (!hasToken) {
    return {
      kind: "invalid",
      title: "Este enlace no es válido",
      message:
        "No pudimos validar este acceso. Abre el enlace completo desde tu correo o solicita uno nuevo.",
      canRetry: false,
    };
  }

  if (publicSignLoading) {
    return {
      kind: "loading",
      title: "Preparando documento",
      message: "Estamos validando el enlace y cargando la información.",
      canRetry: false,
    };
  }

  if (publicSignError) {
    return classifyPublicError(publicSignError);
  }

  if (!document) {
    return {
      kind: "error",
      title: "No se pudo cargar el documento",
      message:
        "El enlace fue reconocido, pero no se encontró la información necesaria para mostrar el documento.",
      canRetry: true,
    };
  }

  if (isVisado && !requiresVisado) {
    return {
      kind: "used",
      title: "Este documento no requiere visado",
      message:
        "El documento se abrió correctamente, pero este enlace no admite registrar un visado.",
      canRetry: false,
    };
  }

  const normalizedDocumentStatus = normalizeStatus(documentStatus);
  const normalizedSignerStatus = normalizeStatus(signerStatus);

  const documentRejected =
    normalizedDocumentStatus === "RECHAZADO" ||
    normalizedDocumentStatus === "REJECTED";

  const documentCompleted =
    !isVisado &&
    ["FIRMADO", "SIGNED", "COMPLETED", "COMPLETADO"].includes(
      normalizedDocumentStatus
    );

  const signerAlreadyDone =
    !isVisado &&
    ["FIRMADO", "SIGNED", "COMPLETED", "COMPLETADO"].includes(
      normalizedSignerStatus
    );

  const visadoAlreadyDone =
    isVisado &&
    ["VISADO", "APPROVED", "COMPLETED", "COMPLETADO"].includes(
      normalizedDocumentStatus
    );

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

  if (visadoAlreadyDone) {
    return {
      kind: "used",
      title: "El visado ya fue registrado",
      message:
        "La revisión del documento ya fue procesada y este enlace no requiere otra acción.",
      canRetry: false,
    };
  }

  return {
    kind: "ready",
    title: isVisado ? "Pendiente de visado" : "Pendiente de firma",
    message: isVisado
      ? "Revisa el documento y registra tu visado cuando estés listo."
      : "Revisa el documento y registra tu firma cuando estés listo.",
    canRetry: false,
  };
}

function getStatusBadge(viewState, isVisado) {
  switch (viewState.kind) {
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
      return {
        label: "Rechazado",
        className: "public-sign-status public-sign-status--danger",
      };
    case "expired":
      return {
        label: "Enlace vencido",
        className: "public-sign-status public-sign-status--danger",
      };
    case "invalid":
      return {
        label: "Enlace inválido",
        className: "public-sign-status public-sign-status--danger",
      };
    case "error":
      return {
        label: "Error",
        className: "public-sign-status public-sign-status--danger",
      };
    case "loading":
      return {
        label: "Cargando",
        className: "public-sign-status public-sign-status--info",
      };
    case "ready":
    default:
      return {
        label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
        className: isVisado
          ? "public-sign-status public-sign-status--warning"
          : "public-sign-status public-sign-status--info",
      };
  }
}

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,
  publicSignPdfUrl,
  publicSignToken,
  publicSignMode,
  publicTokenKind,
  API_URL,
  cargarFirmaPublica,
}) {
  const API_BASE = useMemo(() => normalizePublicApiBase(API_URL), [API_URL]);

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
    () => (publicSignDoc ? publicSignDoc?.document || publicSignDoc || null : null),
    [publicSignDoc]
  );

  const documentMeta = useMemo(
    () =>
      document?.metadata ||
      document?.meta ||
      document?.document_metadata ||
      publicSignDoc?.metadata ||
      publicSignDoc?.meta ||
      {},
    [document, publicSignDoc]
  );

  const signedDocument = useMemo(
    () =>
      publicSignDoc?.signedDocument ||
      publicSignDoc?.signed_document ||
      publicSignDoc?.documento_firmado ||
      null,
    [publicSignDoc]
  );

  const signer = useMemo(
    () =>
      publicSignDoc?.signer ||
      publicSignDoc?.currentSigner ||
      (Array.isArray(publicSignDoc?.signers) ? publicSignDoc.signers[0] : null) ||
      null,
    [publicSignDoc]
  );

  const rawSignerRole = normalizeText(
    signer?.role ||
      signer?.rol ||
      signer?.signer_role ||
      signer?.participant_role
  );

  const requiresVisado = useMemo(() => {
    return Boolean(
      document?.requires_visado ??
        document?.requiresVisado ??
        document?.requiere_visado ??
        documentMeta?.requires_visado ??
        documentMeta?.requiresVisado ??
        documentMeta?.requiere_visado ??
        publicSignDoc?.requires_visado ??
        publicSignDoc?.requiresVisado ??
        publicSignDoc?.requiere_visado ??
        false
    );
  }, [document, documentMeta, publicSignDoc]);

  const effectiveTokenKind = useMemo(() => {
    if (publicTokenKind === "document") return "document";
    if (publicTokenKind === "signer") return "signer";
    if (rawSignerRole.includes("vis")) return "document";
    if (publicSignMode === "visado") return "document";
    return "signer";
  }, [publicTokenKind, rawSignerRole, publicSignMode]);

  const isVisado = useMemo(() => {
    return Boolean(
      publicSignMode === "visado" ||
        rawSignerRole.includes("vis") ||
        (effectiveTokenKind === "document" && requiresVisado)
    );
  }, [publicSignMode, rawSignerRole, effectiveTokenKind, requiresVisado]);

  const resolvedMode = isVisado ? "visado" : "firma";
  const hasToken = !!String(publicSignToken || "").trim();

  useEffect(() => {
    setActionMessage("");
    setActionMessageType("info");
    setAcceptedLegal(false);
    setLegalError("");
    setShowReject(false);
    setRejectReason("");
    setRejectError("");
  }, [publicSignToken, resolvedMode, effectiveTokenKind]);

  const pdfUrl = pickFirstNonEmpty(
    publicSignPdfUrl,
    publicSignDoc?.pdfUrl,
    publicSignDoc?.file_url,
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

  const documentTitle = pickFirstNonEmpty(
    document?.title,
    document?.titulo,
    document?.document_title,
    document?.nombre,
    document?.name,
    signedDocument?.title,
    signedDocument?.titulo,
    "Documento"
  );

  const companyName = pickFirstNonEmpty(
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

  const companyRut = pickFirstNonEmpty(
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

  const contractNumber = pickFirstNonEmpty(
    document?.numero_contrato_interno,
    document?.numerocontratointerno,
    document?.numero_contrato,
    document?.numeroContrato,
    document?.contract_number,
    document?.n_contrato,
    documentMeta?.numeroContratoInterno,
    documentMeta?.numero_contrato_interno,
    documentMeta?.numerocontratointerno,
    documentMeta?.numero_contrato,
    documentMeta?.numeroContrato,
    documentMeta?.contract_number,
    signedDocument?.numero_contrato_interno,
    signedDocument?.numerocontratointerno,
    signedDocument?.numero_contrato,
    signedDocument?.contract_number,
    publicSignDoc?.numero_contrato_interno,
    publicSignDoc?.numerocontratointerno,
    publicSignDoc?.numero_contrato,
    publicSignDoc?.contract_number,
    "Sin número"
  );

  const procedureFieldLabel = getProcedureFieldLabel({
    ...document,
    metadata: documentMeta,
  });

  const baseProcedureLabel = getProcedureLabel({
    ...document,
    metadata: documentMeta,
  });

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

  const procedureLabel = isVisado
    ? documentStatus === "VISADO"
      ? "Visado registrado"
      : requiresVisado
      ? "Con visado"
      : baseProcedureLabel
    : baseProcedureLabel;

  const signerRoleLabel = resolveSignerRoleLabel(signer, isVisado);

  const participantInfo = getReadableParticipantLabel({
    signer,
    isVisado,
    document,
  });

  const viewState = useMemo(
    () =>
      resolveViewState({
        hasToken,
        publicSignLoading,
        publicSignError,
        document,
        documentStatus,
        signerStatus,
        isVisado,
        requiresVisado,
      }),
    [
      hasToken,
      publicSignLoading,
      publicSignError,
      document,
      documentStatus,
      signerStatus,
      isVisado,
      requiresVisado,
    ]
  );

  const statusBadge = useMemo(
    () => getStatusBadge(viewState, isVisado),
    [viewState, isVisado]
  );

  const canRenderDocument = !!document;
  const canRenderActions = viewState.kind === "ready";

  const canSubmitVisado =
    canRenderActions &&
    !!publicSignToken &&
    !!API_BASE &&
    isVisado &&
    requiresVisado;

  const canSubmitFirma =
    canRenderActions &&
    !!publicSignToken &&
    !!API_BASE &&
    !isVisado &&
    effectiveTokenKind === "signer";

  const canSubmitAction = canSubmitVisado || canSubmitFirma;

  const canReject =
    canRenderActions &&
    !isVisado &&
    effectiveTokenKind === "signer" &&
    !!publicSignToken &&
    !!API_BASE;

  useEffect(() => {
    if (!canRenderActions) {
      setShowReject(false);
      setRejectReason("");
      setRejectError("");
      setLegalError("");
    }
  }, [canRenderActions]);

  const handleRetryLoad = useCallback(() => {
    if (!publicSignToken || typeof cargarFirmaPublica !== "function") return;

    cargarFirmaPublica(publicSignToken, {
      mode: resolvedMode,
      tokenKind: effectiveTokenKind,
    });
  }, [cargarFirmaPublica, publicSignToken, resolvedMode, effectiveTokenKind]);

  const reloadPublicState = useCallback(async () => {
    if (!publicSignToken || typeof cargarFirmaPublica !== "function") {
      return null;
    }

    return await cargarFirmaPublica(publicSignToken, {
      mode: resolvedMode,
      tokenKind: effectiveTokenKind,
    });
  }, [cargarFirmaPublica, publicSignToken, resolvedMode, effectiveTokenKind]);

  const handleConfirm = useCallback(async () => {
    if (signing || rejecting || !canSubmitAction) return;

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

      const endpoint = buildActionEndpoint({
        apiBase: API_BASE,
        token: publicSignToken,
        isVisado,
      });

      const data = await fetchJsonSafe(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      await reloadPublicState();

      setActionMessage(buildActionSuccessMessage(isVisado, data?.message));
      setActionMessageType("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setActionMessage(buildActionErrorMessage(isVisado, err?.message));
      setActionMessageType("error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSigning(false);
    }
  }, [
    signing,
    rejecting,
    canSubmitAction,
    acceptedLegal,
    isVisado,
    API_BASE,
    publicSignToken,
    reloadPublicState,
  ]);

  const handleReject = useCallback(async () => {
    if (rejecting || signing || !canReject) return;

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

      const endpoint = buildRejectEndpoint({
        apiBase: API_BASE,
        token: publicSignToken,
        tokenKind: effectiveTokenKind,
      });

      const data = await fetchJsonSafe(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });

      await reloadPublicState();

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
    canReject,
    rejectReason,
    API_BASE,
    publicSignToken,
    effectiveTokenKind,
    reloadPublicState,
  ]);

  const handleToggleReject = useCallback(() => {
    if (!canReject) return;
    setShowReject((prev) => !prev);
    setRejectReason("");
    setRejectError("");
  }, [canReject]);

  if (import.meta.env.DEV) {
    console.log("[PUBLIC VIEW STATE]", {
      hasToken,
      hasDocument: !!document,
      publicSignLoading,
      hasError: !!publicSignError,
      effectiveTokenKind,
      publicSignMode,
      rawSignerRole,
      requiresVisado,
      isVisado,
      canSubmitVisado,
      canSubmitFirma,
      viewStateKind: viewState.kind,
      documentStatus,
      signerStatus,
    });
  }

  const actionBlock = canRenderActions ? (
    <div className="public-sign-action-block">
      <div className="public-sign-legal-box">
        <label className="public-sign-legal-check">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => {
              setAcceptedLegal(e.target.checked);
              if (e.target.checked) setLegalError("");
            }}
          />
          <span>
            He leído y acepto el aviso legal para registrar mi{" "}
            {isVisado ? "visado" : "firma electrónica"}.
          </span>
        </label>
      </div>

      <ElectronicSignatureNotice />

      {legalError && (
        <div className="public-sign-inline-error">{legalError}</div>
      )}

      {!canSubmitAction && (
        <div className="public-sign-inline-error">
          No se puede habilitar la acción para este enlace.
        </div>
      )}

      <p className="public-sign-helper-text">
        Al continuar, registrarás tu {isVisado ? "visado" : "firma electrónica"}.
        Esta acción no se puede deshacer.
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
            disabled={signing || rejecting || !acceptedLegal || !canSubmitAction}
          >
            {signing
              ? "Procesando..."
              : isVisado
              ? "Registrar visado"
              : signerRoleLabel === "Firmante final"
              ? "Registrar firma final"
              : "Registrar firma"}
          </button>

          {canReject && (
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

      {showReject && canReject && (
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
            <h1 className="public-sign-title">
              {isVisado ? "Visado de documento" : "Firma electrónica"}
            </h1>
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
            {viewState.kind === "ready"
              ? isVisado
                ? "Revisa este documento para registrar tu visado"
                : signerRoleLabel === "Firmante final"
                ? "Revisa este documento para registrar tu firma final"
                : "Revisa este documento para registrar tu firma"
              : viewState.title}
          </div>

          <div className="public-sign-intro__text">{viewState.message}</div>
        </section>

        {actionMessage && (
          <div className={messageCardClassName}>
            <div className="public-sign-message-card__text">{actionMessage}</div>
          </div>
        )}

        {viewState.kind === "loading" && (
          <div className="public-sign-message-card">
            <div className="spinner public-sign-spinner" />
            <div className="public-sign-message-card__title">
              {viewState.title}
            </div>
            <div className="public-sign-message-card__text">
              {viewState.message}
            </div>
          </div>
        )}

        {["invalid", "expired", "used", "rejected", "completed", "error"].includes(
          viewState.kind
        ) &&
          !canRenderDocument && (
            <div
              className={`public-sign-message-card ${
                viewState.kind === "error" ||
                viewState.kind === "invalid" ||
                viewState.kind === "expired" ||
                viewState.kind === "rejected"
                  ? "public-sign-message-card--error"
                  : "public-sign-message-card--info"
              }`}
            >
              <div className="public-sign-message-card__title">
                {viewState.title}
              </div>
              <div className="public-sign-message-card__text">
                {viewState.message}
              </div>

              {viewState.canRetry && (
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

        {canRenderDocument && (
          <div className="public-sign-layout">
            <aside className="public-sign-sidebar">
              <div className="public-sign-summary">
                <div className="public-sign-section-label">Resumen</div>
                <div
                  className="public-sign-summary__title"
                  title={documentTitle}
                >
                  {documentTitle}
                </div>
                <div className="public-sign-summary__text">
                  Revisa la información principal antes de abrir el documento completo.
                </div>
              </div>

              <div className="public-sign-meta-grid">
                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">Empresa</div>
                  <div
                    className="public-sign-meta-card__value"
                    title={buildMetaTitle("Empresa", companyName, `RUT: ${companyRut}`)}
                  >
                    {companyName}
                  </div>
                  <div
                    className="public-sign-meta-card__subvalue"
                    title={`RUT: ${companyRut}`}
                  >
                    RUT: {companyRut}
                  </div>
                </div>

                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">
                    Número de contrato
                  </div>
                  <div
                    className="public-sign-meta-card__value public-sign-meta-card__value--contract"
                    title={contractNumber}
                  >
                    {contractNumber}
                  </div>
                </div>

                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">
                    {procedureFieldLabel}
                  </div>
                  <div
                    className="public-sign-meta-card__value"
                    title={procedureLabel}
                  >
                    {procedureLabel}
                  </div>
                </div>

                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">
                    {participantInfo.title}
                  </div>
                  <div
                    className="public-sign-meta-card__value"
                    title={buildMetaTitle(
                      participantInfo.title,
                      participantInfo.primary,
                      participantInfo.secondary
                    )}
                  >
                    {participantInfo.primary}
                  </div>
                  <div
                    className="public-sign-meta-card__subvalue"
                    title={participantInfo.secondary}
                  >
                    {participantInfo.secondary}
                  </div>
                </div>
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

              {viewState.kind !== "ready" && (
                <div className="public-sign-message-card public-sign-message-card--info">
                  <div className="public-sign-message-card__title">
                    {viewState.title}
                  </div>
                  <div className="public-sign-message-card__text">
                    {viewState.message}
                  </div>

                  {viewState.canRetry && (
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

              <div className="public-sign-desktop-actions">{actionBlock}</div>
            </aside>

            <section className="public-sign-document-panel">
              <div className="public-sign-document-panel__header">
                <div>
                  <div className="public-sign-section-label">Documento</div>
                  <div
                    className="public-sign-document-title"
                    title={documentTitle}
                  >
                    {documentTitle}
                  </div>
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

              <div className="public-sign-mobile-actions">{actionBlock}</div>
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