// src/views/PublicSignView.jsx
import React, { useMemo } from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { PublicPdfViewer } from "../components/PublicPdfViewer";
import { PublicSignActions } from "./publicSign/PublicSignActions";
import {
  usePublicSignLogic,
  buildMetaTitle,
} from "./publicSign/usePublicSignLogic";

// Estados terminales: solo lectura / mensajes, sin acciones nuevas
const TERMINAL_VIEW_STATES = new Set([
  "invalid",
  "expired",
  "used",
  "rejected",
  "completed",
  "error",
  "blocked_by_review",
]);

// Mapea un "kind" de estado a una variante visual simple
function getMessageVariant(kind, preferred) {
  if (preferred) return preferred;

  const normalized = String(kind || "").toLowerCase();

  if (["error", "invalid", "expired"].includes(normalized)) {
    return "error";
  }

  if (["completed", "used", "rejected"].includes(normalized)) {
    return "success";
  }

  return "info";
}

function PublicStatusMessageCard({
  viewState,
  onRetry,
  variant,
  showSpinner = false,
}) {
  const safeViewState = viewState || {};
  const resolvedVariant = getMessageVariant(safeViewState.kind, variant);

  const className = `public-sign-message-card ${
    resolvedVariant === "error"
      ? "public-sign-message-card--error"
      : resolvedVariant === "success"
      ? "public-sign-message-card--success"
      : "public-sign-message-card--info"
  }`;

  const canShowRetry = Boolean(
    safeViewState.canRetry && typeof onRetry === "function"
  );

  return (
    <div className={className} role="status" aria-live="polite">
      {showSpinner && <div className="spinner public-sign-spinner" />}

      {safeViewState.title && (
        <div className="public-sign-message-card__title">
          {safeViewState.title}
        </div>
      )}

      {safeViewState.message && (
        <div className="public-sign-message-card__text">
          {safeViewState.message}
        </div>
      )}

      {canShowRetry && (
        <button
          type="button"
          className="public-sign-button public-sign-button--secondary public-sign-button--auto"
          onClick={onRetry}
        >
          Reintentar carga
        </button>
      )}
    </div>
  );
}

function PublicDocumentSummary({
  documentTitle,
  companyName,
  companyRut,
  contractNumber,
  procedureFieldLabel,
  procedureLabel,
  participantInfo,
  pdfUrl,
  viewState,
  actionBlock,
  onRetry,
  showInlineStatus,
}) {
  const hasCompany = Boolean(companyName || companyRut);
  const hasProcedure = Boolean(procedureFieldLabel && procedureLabel);
  const hasParticipant = Boolean(participantInfo?.title);

  return (
    <aside className="public-sign-sidebar">
      <div className="public-sign-summary">
        <div className="public-sign-section-label">Resumen</div>

        <div className="public-sign-summary__title" title={documentTitle}>
          {documentTitle}
        </div>

        <div className="public-sign-summary__text">
          Revisa estos datos antes de confirmar tu acción sobre el documento.
        </div>
      </div>

      <div className="public-sign-meta-grid">
        {hasCompany && (
          <div className="public-sign-meta-card">
            <div className="public-sign-meta-card__label">Empresa emisora</div>
            <div
              className="public-sign-meta-card__value"
              title={buildMetaTitle(
                "Empresa",
                companyName,
                companyRut ? `RUT: ${companyRut}` : ""
              )}
            >
              {companyName}
            </div>
            {companyRut && (
              <div
                className="public-sign-meta-card__subvalue"
                title={`RUT: ${companyRut}`}
              >
                RUT: {companyRut}
              </div>
            )}
          </div>
        )}

        {contractNumber && (
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
        )}

        {hasProcedure && (
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
        )}

        {hasParticipant && (
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
            {participantInfo.secondary && (
              <div
                className="public-sign-meta-card__subvalue"
                title={participantInfo.secondary}
              >
                {participantInfo.secondary}
              </div>
            )}
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
          Abrir documento completo en otra pestaña
        </a>
      )}

      {showInlineStatus && (
        <PublicStatusMessageCard
          viewState={viewState}
          onRetry={onRetry}
          variant={getMessageVariant(viewState?.kind)}
        />
      )}

      <div className="public-sign-desktop-actions">{actionBlock}</div>
    </aside>
  );
}

function PublicDocumentPanel({ pdfUrl, documentTitle, actionBlock }) {
  return (
    <section className="public-sign-document-panel">
      <div className="public-sign-document-panel__header">
        <div>
          <div className="public-sign-section-label">Documento</div>
          <div className="public-sign-document-title" title={documentTitle}>
            {documentTitle}
          </div>
        </div>
      </div>

      <div className="public-sign-pdf-stage">
        {pdfUrl ? (
          <PublicPdfViewer fileUrl={pdfUrl} />
        ) : (
          <div className="public-sign-pdf-empty">
            No pudimos mostrar la vista previa en este momento. Si el enlace lo
            permite, abre el documento completo en una nueva pestaña.
          </div>
        )}
      </div>

      <div className="public-sign-mobile-actions">{actionBlock}</div>
    </section>
  );
}

export function PublicSignView(props) {
  const {
    isVisado,
    pdfUrl,
    documentTitle,
    companyName,
    companyRut,
    contractNumber,
    procedureFieldLabel,
    procedureLabel,
    signerRoleLabel,
    participantInfo,
    viewState: rawViewState,
    statusBadge,
    canRenderDocument,
    canRenderActions,
    canSubmitAction,
    canReject,
    showReject,
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
  } = usePublicSignLogic(props);

  const viewState = rawViewState || { kind: "loading" };
  const isLoading = viewState.kind === "loading";

  const isTerminal = useMemo(
    () => TERMINAL_VIEW_STATES.has(viewState.kind),
    [viewState.kind]
  );

  const isTerminalWithoutDocument = useMemo(
    () => isTerminal && !canRenderDocument,
    [isTerminal, canRenderDocument]
  );

  // Título principal de la intro, orientado al estado del enlace
  const introTitle = useMemo(() => {
    if (isTerminal) {
      if (viewState.title) return viewState.title;

      if (viewState.kind === "expired") {
        return "Este enlace ya expiró";
      }

      if (viewState.kind === "invalid") {
        return "Este enlace no es válido";
      }

      if (viewState.kind === "rejected") {
        return "El documento fue rechazado";
      }

      if (viewState.kind === "completed" || viewState.kind === "used") {
        return isVisado
          ? "Visado registrado correctamente"
          : "Acción registrada correctamente";
      }

      if (viewState.kind === "blocked_by_review") {
        return "El documento está en revisión";
      }

      return "Portal de firma pública";
    }

    if (viewState.kind !== "ready" && viewState.title) {
      return viewState.title;
    }

    if (isVisado) {
      return "Revisa el documento antes de registrar tu visado";
    }

    if (signerRoleLabel === "Firmante final") {
      return "Revisa el documento antes de firmar";
    }

    return "Revisa el documento antes de continuar";
  }, [isTerminal, viewState.title, viewState.kind, isVisado, signerRoleLabel]);

  // Texto descriptivo de la intro, evitando tecnicismos
  const introText = useMemo(() => {
    if (isTerminal) {
      if (viewState.message) return viewState.message;

      if (viewState.kind === "expired") {
        return "Este enlace de firma ya no está disponible. Pide al remitente que te envíe un nuevo enlace para continuar.";
      }

      if (viewState.kind === "invalid") {
        return "El enlace que abriste no es válido o está incompleto. Verifica que lo hayas copiado completo o solicita uno nuevo.";
      }

      if (viewState.kind === "rejected") {
        return "Este documento fue rechazado por uno de los participantes. El flujo de firma quedó cerrado desde este enlace.";
      }

      if (viewState.kind === "completed" || viewState.kind === "used") {
        return isVisado
          ? "Tu visado ya fue registrado correctamente. No es necesario que realices más acciones desde este enlace."
          : "Tu acción ya fue registrada sobre este documento. No necesitas completar nada más desde este enlace.";
      }

      if (viewState.kind === "error") {
        return "Tuvimos un problema al cargar el documento. Intenta nuevamente más tarde o contacta al remitente si el problema continúa.";
      }

      if (viewState.kind === "blocked_by_review") {
        return "El emisor está revisando el documento. Por ahora no se pueden registrar nuevas acciones desde este enlace.";
      }

      return "No hay más acciones disponibles para este enlace público.";
    }

    if (viewState.kind !== "ready" && viewState.message) {
      return viewState.message;
    }

    if (isVisado) {
      return "Lee el documento, confirma que la información es correcta y luego registra tu visado para permitir que el flujo continúe.";
    }

    return "Lee el documento con calma, verifica los datos y luego confirma la acción que te corresponde.";
  }, [isTerminal, viewState.message, viewState.kind, isVisado]);

  // Bloque de acciones principal (firma / visado / rechazo)
  const actionBlock = useMemo(() => {
    if (!canRenderActions || isTerminal) return null;

    return (
      <PublicSignActions
        acceptedLegal={acceptedLegal}
        onChangeLegal={(value) => {
          setAcceptedLegal(value);
          if (value) setLegalError("");
        }}
        legalError={legalError}
        canSubmitAction={canSubmitAction}
        isVisado={isVisado}
        signerRoleLabel={signerRoleLabel}
        signing={signing}
        rejecting={rejecting}
        onConfirm={handleConfirm}
        canReject={canReject}
        showReject={showReject}
        onToggleReject={handleToggleReject}
        rejectReason={rejectReason}
        onChangeRejectReason={setRejectReason}
        rejectError={rejectError}
        onReject={handleReject}
      />
    );
  }, [
    acceptedLegal,
    canRenderActions,
    canReject,
    canSubmitAction,
    handleConfirm,
    handleReject,
    handleToggleReject,
    isTerminal,
    isVisado,
    legalError,
    rejectError,
    rejectReason,
    rejecting,
    setAcceptedLegal,
    setLegalError,
    setRejectReason,
    showReject,
    signerRoleLabel,
    signing,
  ]);

  const actionMessageClassName = useMemo(() => {
    const variant = getMessageVariant(actionMessageType);
    return `public-sign-message-card ${
      variant === "error"
        ? "public-sign-message-card--error"
        : variant === "success"
        ? "public-sign-message-card--success"
        : "public-sign-message-card--info"
    }`;
  }, [actionMessageType]);

  const introClassName = useMemo(
    () =>
      `public-sign-intro ${
        isVisado ? "public-sign-intro--warning" : "public-sign-intro--info"
      }`,
    [isVisado]
  );

  const introTitleClassName = useMemo(
    () =>
      `public-sign-intro__title ${
        isVisado
          ? "public-sign-intro__title--warning"
          : "public-sign-intro__title--info"
      }`,
    [isVisado]
  );

  const showInlineStatusInSummary = useMemo(
    () => !isTerminal && viewState.kind !== "ready",
    [isTerminal, viewState.kind]
  );

  return (
    <div className="public-sign-page">
      <div className="public-sign-shell">
        <PublicHeader />

        <header className="public-sign-heading">
          <div>
            <div className="public-sign-eyebrow">
              VeriFirma · Portal público
            </div>
            <h1 className="public-sign-title">
              {isVisado ? "Visado de documento" : "Firma electrónica"}
            </h1>
          </div>

          <div className={statusBadge.className}>{statusBadge.label}</div>
        </header>

        <section className={introClassName}>
          <div className={introTitleClassName}>{introTitle}</div>
          <div className="public-sign-intro__text">{introText}</div>
        </section>

        {actionMessage && (
          <div
            className={actionMessageClassName}
            role="status"
            aria-live="polite"
          >
            <div className="public-sign-message-card__text">
              {actionMessage}
            </div>
          </div>
        )}

        {isLoading && (
          <PublicStatusMessageCard
            viewState={viewState}
            onRetry={handleRetryLoad}
            variant="info"
            showSpinner
          />
        )}

        {isTerminalWithoutDocument && !isLoading && (
          <PublicStatusMessageCard
            viewState={viewState}
            onRetry={handleRetryLoad}
            variant={getMessageVariant(viewState.kind)}
          />
        )}

        {isTerminal && canRenderDocument && !isLoading && (
          <>
            <PublicStatusMessageCard
              viewState={viewState}
              onRetry={handleRetryLoad}
              variant={getMessageVariant(viewState.kind)}
            />
            <div className="public-sign-layout">
              <PublicDocumentSummary
                documentTitle={documentTitle}
                companyName={companyName}
                companyRut={companyRut}
                contractNumber={contractNumber}
                procedureFieldLabel={procedureFieldLabel}
                procedureLabel={procedureLabel}
                participantInfo={participantInfo}
                pdfUrl={pdfUrl}
                viewState={viewState}
                actionBlock={null}
                onRetry={handleRetryLoad}
                showInlineStatus={false}
              />
              <PublicDocumentPanel
                pdfUrl={pdfUrl}
                documentTitle={documentTitle}
                actionBlock={null}
              />
            </div>
          </>
        )}

        {!isTerminal && canRenderDocument && (
          <div className="public-sign-layout">
            <PublicDocumentSummary
              documentTitle={documentTitle}
              companyName={companyName}
              companyRut={companyRut}
              contractNumber={contractNumber}
              procedureFieldLabel={procedureFieldLabel}
              procedureLabel={procedureLabel}
              participantInfo={participantInfo}
              pdfUrl={pdfUrl}
              viewState={viewState}
              actionBlock={actionBlock}
              onRetry={handleRetryLoad}
              showInlineStatus={showInlineStatusInSummary}
            />
            <PublicDocumentPanel
              pdfUrl={pdfUrl}
              documentTitle={documentTitle}
              actionBlock={actionBlock}
            />
          </div>
        )}

        <div className="public-sign-footer-wrap">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}