import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizePublicApiBase,
  normalizeStatus,
  normalizeText,
  pickFirstNonEmpty,
  sanitizePublicMessage,
  fetchJsonSafe,
  resolveSignerRoleLabel,
  buildMetaTitle,
  getReadableParticipantLabel,
  buildActionEndpoint,
  buildRejectEndpoint,
  buildActionSuccessMessage,
  buildActionErrorMessage,
  buildRejectErrorMessage,
  resolveViewState,
  getStatusBadge,
} from "./publicSignState";
import {
  getProcedureFieldLabel,
  getProcedureLabel,
} from "../../utils/documentLabels";

export function usePublicSignLogic({
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
  const API_BASE = useMemo(
    () => normalizePublicApiBase(API_URL),
    [API_URL]
  );

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [signing, setSigning] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionMessageType, setActionMessageType] = useState("info"); // "info" | "success" | "error"

  // Estado terminal manual para evitar volver a "ready" tras la acción
  const [terminalViewState, setTerminalViewState] = useState(null);

  const document = useMemo(
    () =>
      publicSignDoc
        ? publicSignDoc.document ?? publicSignDoc ?? null
        : null,
    [publicSignDoc]
  );

  const documentMeta = useMemo(
    () =>
      document?.metadata ??
      document?.meta ??
      document?.document_metadata ??
      publicSignDoc?.metadata ??
      publicSignDoc?.meta ??
      {},
    [document, publicSignDoc]
  );

  const signedDocument = useMemo(
    () =>
      publicSignDoc?.signedDocument ??
      publicSignDoc?.signed_document ??
      publicSignDoc?.documento_firmado ??
      null,
    [publicSignDoc]
  );

  const signer = useMemo(
    () =>
      publicSignDoc?.signer ??
      publicSignDoc?.currentSigner ??
      (Array.isArray(publicSignDoc?.signers)
        ? publicSignDoc.signers[0]
        : null) ??
      null,
    [publicSignDoc]
  );

  const rawSignerRole = normalizeText(
    signer?.role ??
      signer?.rol ??
      signer?.signer_role ??
      signer?.participant_role
  );

  const documentStatus = normalizeStatus(
    document?.status ??
      document?.document_status ??
      document?.estado ??
      signedDocument?.status ??
      signedDocument?.estado
  );

  const signerStatus = normalizeStatus(
    signer?.status ?? signer?.signer_status ?? signer?.estado
  );

  const requiresVisado = useMemo(() => {
    const explicitFlag = Boolean(
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

    const inferredFromStatus = ["PENDIENTE_VISADO", "VISADO"].includes(
      documentStatus
    );

    return explicitFlag || inferredFromStatus;
  }, [document, documentMeta, publicSignDoc, documentStatus]);

  const effectiveTokenKind = useMemo(() => {
    if (publicTokenKind === "document") return "document";
    if (publicTokenKind === "signer") return "signer";
    if (publicSignMode === "visado") return "document";
    return "signer";
  }, [publicTokenKind, publicSignMode]);

  const isVisado = useMemo(
    () =>
      Boolean(
        publicSignMode === "visado" || effectiveTokenKind === "document"
      ),
    [publicSignMode, effectiveTokenKind]
  );

  const resolvedMode = isVisado ? "visado" : "firma";
  const hasToken = !!normalizeText(publicSignToken);

  // Reset de estado cuando cambia el token o el modo efectivo
  useEffect(() => {
    setActionMessage("");
    setActionMessageType("info");
    setAcceptedLegal(false);
    setLegalError("");
    setShowReject(false);
    setRejectReason("");
    setRejectError("");
    setTerminalViewState(null);
  }, [publicSignToken, resolvedMode, effectiveTokenKind]);

  const pdfUrl = useMemo(
    () =>
      pickFirstNonEmpty(
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
      ),
    [publicSignPdfUrl, publicSignDoc, document, signedDocument]
  );

  const documentTitle = useMemo(
    () =>
      pickFirstNonEmpty(
        document?.title,
        document?.titulo,
        document?.document_title,
        document?.nombre,
        document?.name,
        signedDocument?.title,
        signedDocument?.titulo,
        "Documento"
      ),
    [document, signedDocument]
  );

  const companyName = useMemo(
    () =>
      pickFirstNonEmpty(
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
      ),
    [document, documentMeta, signedDocument, publicSignDoc]
  );

  const companyRut = useMemo(
    () =>
      pickFirstNonEmpty(
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
      ),
    [document, documentMeta, signedDocument, publicSignDoc]
  );

  const contractNumber = useMemo(
    () =>
      pickFirstNonEmpty(
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
      ),
    [document, documentMeta, signedDocument, publicSignDoc]
  );

  const procedureFieldLabel = useMemo(
    () =>
      getProcedureFieldLabel({
        ...document,
        metadata: documentMeta,
      }),
    [document, documentMeta]
  );

  const baseProcedureLabel = useMemo(
    () =>
      getProcedureLabel({
        ...document,
        metadata: documentMeta,
      }),
    [document, documentMeta]
  );

  const procedureLabel = useMemo(() => {
    if (!isVisado) return baseProcedureLabel;

    if (documentStatus === "VISADO") return "Visado registrado";
    if (requiresVisado) return "Con visado";

    return baseProcedureLabel;
  }, [isVisado, baseProcedureLabel, documentStatus, requiresVisado]);

  const signerRoleLabel = useMemo(
    () => resolveSignerRoleLabel(signer, isVisado),
    [signer, isVisado]
  );

  const participantInfo = useMemo(
    () =>
      getReadableParticipantLabel({
        signer,
        isVisado,
        document,
      }),
    [signer, isVisado, document]
  );

  const baseViewState = useMemo(
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

  // Si hay estado terminal manual, tiene prioridad
  const viewState = useMemo(
    () => terminalViewState || baseViewState,
    [terminalViewState, baseViewState]
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
    effectiveTokenKind === "document";

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

  // Reset de errores cuando se deshabilitan acciones
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

    return cargarFirmaPublica(publicSignToken, {
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

      const payload = {
        acceptedLegal: true,
        mode: resolvedMode,
      };

      const data = await fetchJsonSafe(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await reloadPublicState();

      const successMsg = buildActionSuccessMessage(isVisado, data?.message);
      setActionMessage(successMsg);
      setActionMessageType("success");

      // Si fue visado, pasamos a estado terminal "completed"
      if (isVisado) {
        setTerminalViewState({
          kind: "completed",
          title: "Documento visado correctamente",
          message:
            successMsg ||
            "El documento fue visado correctamente desde este enlace público y quedó habilitado para continuar con la firma.",
        });
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? err.message
          : "Ocurrió un error al registrar la acción.";
      setActionMessage(buildActionErrorMessage(isVisado, message));
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
    resolvedMode,
  ]);

  const handleReject = useCallback(async () => {
    if (rejecting || signing || !canReject) return;

    const motivo = normalizeText(rejectReason);

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

      const msg = sanitizePublicMessage(
        data?.message,
        "Documento rechazado correctamente."
      );

      setActionMessage(msg);
      setActionMessageType("success");
      setShowReject(false);
      setRejectReason("");
      setRejectError("");

      // Para rechazo público también podemos marcar terminal
      setTerminalViewState({
        kind: "completed",
        title: "Documento rechazado correctamente",
        message: msg,
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? err.message
          : "No se pudo registrar el rechazo.";
      setRejectError(buildRejectErrorMessage(message));
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
    console.log("[PublicSignView]", {
      hasToken,
      hasDocument: !!document,
      loading: publicSignLoading,
      error: !!publicSignError,
      effectiveTokenKind,
      mode: publicSignMode,
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

  return {
    API_BASE,
    document,
    documentMeta,
    signedDocument,
    signer,
    rawSignerRole,
    requiresVisado,
    effectiveTokenKind,
    isVisado,
    resolvedMode,
    hasToken,
    pdfUrl,
    documentTitle,
    companyName,
    companyRut,
    contractNumber,
    procedureFieldLabel,
    procedureLabel,
    signerStatus,
    documentStatus,
    signerRoleLabel,
    participantInfo,
    viewState,
    statusBadge,
    canRenderDocument,
    canRenderActions,
    canSubmitVisado,
    canSubmitFirma,
    canSubmitAction,
    canReject,
    showReject,
    setShowReject,
    rejectReason,
    setRejectReason,
    rejecting,
    rejectError,
    acceptedLegal,
    setAcceptedLegal,
    legalError,
    signing,
    actionMessage,
    actionMessageType,
    handleRetryLoad,
    handleConfirm,
    handleReject,
    handleToggleReject,
    setLegalError,
  };
}

export { buildMetaTitle };