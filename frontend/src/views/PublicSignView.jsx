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

const TERMINAL_VIEW_STATES = new Set([
  "invalid",
  "expired",
  "used",
  "rejected",
  "completed",
  "error",
  "blocked_by_review",
]);

function PublicStatusMessageCard({
  viewState,
  onRetry,
  variant = "info",
  showSpinner = false,
}) {
  const className = `public-sign-message-card ${
    variant === "error"
      ? "public-sign-message-card--error"
      : variant === "success"
      ? "public-sign-message-card--success"
      : "public-sign-message-card--info"
  }`;

  return (
    <div className={className} role="status" aria-live="polite">
      {showSpinner ? <div className="spinner public-sign-spinner" /> : null}

      {viewState?.title ? (
        <div className="public-sign-message-card__title">{viewState.title}</div>
      ) : null}

      {viewState?.message ? (
        <div className="public-sign-message-card__text">{viewState.message}</div>
      ) : null}

      {viewState?.canRetry ? (
        <button
          type="button"
          className="public-sign-button public-sign-button--secondary public-sign-button--auto"
          onClick={onRetry}
        >
          Reintentar carga
        </button>
      ) : null}
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
}) {
  return (
    <aside className="public-sign-sidebar">
      <div className="public-sign-summary">
        <div className="public-sign-section-label">Resumen</div>

        <div className="public-sign-summary__title" title={documentTitle}>
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
          <div className="public-sign-meta-card__label">Número de contrato</div>

          <div
            className="public-sign-meta-card__value public-sign-meta-card__value--contract"
            title={contractNumber}
          >
            {contractNumber}
          </div>
        </div>

        <div className="public-sign-meta-card">
          <div className="public-sign-meta-card__label">{procedureFieldLabel}</div>

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

      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="public-sign-open-pdf public-sign-open-pdf--fullwidth"
        >
          Abrir documento completo
        </a>
      ) : null}

      {viewState.kind !== "ready" ? (
        <PublicStatusMessageCard
          viewState={viewState}
          onRetry={onRetry}
          variant="info"
        />
      ) : null}

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
            No hay una vista previa disponible en este momento. Puedes abrir el
            documento completo en una nueva pestaña si el enlace está habilitado.
          </div>
        )}
      </div>

      <div className="public-sign-mobile-actions">{actionBlock}</div>
    </section>
  );
}

export function PublicSignView(props) {
  const {
    document,
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
    viewState,
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

  const isTerminalWithoutDocument = useMemo(() => {
    return TERMINAL_VIEW_STATES.has(viewState.kind) && !canRenderDocument;
  }, [viewState.kind, canRenderDocument]);

  const introTitle = useMemo(() => {
    if (viewState.kind !== "ready") return viewState.title;

    if (isVisado) {
      return "Revisa este documento para registrar tu visado";
    }

    if (signerRoleLabel === "Firmante final") {
      return "Revisa este documento para registrar tu firma final";
    }

    return "Revisa este documento para registrar tu firma";
  }, [viewState.kind, viewState.title, isVisado, signerRoleLabel]);

  const actionBlock = useMemo(() => {
    if (!canRenderActions) return null;

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
    return `public-sign-message-card ${
      actionMessageType === "error"
        ? "public-sign-message-card--error"
        : actionMessageType === "success"
        ? "public-sign-message-card--success"
        : "public-sign-message-card--info"
    }`;
  }, [actionMessageType]);

  const introClassName = useMemo(() => {
    return `public-sign-intro ${
      isVisado ? "public-sign-intro--warning" : "public-sign-intro--info"
    }`;
  }, [isVisado]);

  const introTitleClassName = useMemo(() => {
    return `public-sign-intro__title ${
      isVisado
        ? "public-sign-intro__title--warning"
        : "public-sign-intro__title--info"
    }`;
  }, [isVisado]);

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

        <section className={introClassName}>
          <div className={introTitleClassName}>{introTitle}</div>
          <div className="public-sign-intro__text">{viewState.message}</div>
        </section>

        {actionMessage ? (
          <div className={actionMessageClassName} role="status" aria-live="polite">
            <div className="public-sign-message-card__text">{actionMessage}</div>
          </div>
        ) : null}

        {viewState.kind === "loading" ? (
          <PublicStatusMessageCard
            viewState={viewState}
            onRetry={handleRetryLoad}
            variant="info"
            showSpinner
          />
        ) : null}

        {isTerminalWithoutDocument ? (
          <PublicStatusMessageCard
            viewState={viewState}
            onRetry={handleRetryLoad}
            variant={
              viewState.kind === "completed" || viewState.kind === "used"
                ? "info"
                : "error"
            }
          />
        ) : null}

        {canRenderDocument ? (
          <div className="public-sign-layout">
            <PublicDocumentSummary
              document={document}
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
            />

            <PublicDocumentPanel
              pdfUrl={pdfUrl}
              documentTitle={documentTitle}
              actionBlock={actionBlock}
            />
          </div>
        ) : null}

        <div className="public-sign-footer-wrap">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}