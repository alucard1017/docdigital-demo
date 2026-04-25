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

// Estados terminales: no hay más acciones posibles, solo lectura / mensajes
const TERMINAL_VIEW_STATES = new Set([
  "invalid",
  "expired",
  "used",
  "rejected",
  "completed",
  "error",
  "blocked_by_review",
]);

function getMessageVariant(kind, preferred) {
  if (preferred) return preferred;

  const normalized = String(kind || "").toLowerCase();

  if (
    normalized === "error" ||
    normalized === "invalid" ||
    normalized === "expired"
  ) {
    return "error";
  }

  if (
    normalized === "completed" ||
    normalized === "used" ||
    normalized === "rejected"
  ) {
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
  const resolvedVariant = getMessageVariant(viewState?.kind, variant);

  const className = `public-sign-message-card ${
    resolvedVariant === "error"
      ? "public-sign-message-card--error"
      : resolvedVariant === "success"
      ? "public-sign-message-card--success"
      : "public-sign-message-card--info"
  }`;

  return (
    <div className={className} role="status" aria-live="polite">
      {showSpinner && <div className="spinner public-sign-spinner" />}

      {viewState?.title && (
        <div className="public-sign-message-card__title">
          {viewState.title}
        </div>
      )}

      {viewState?.message && (
        <div className="public-sign-message-card__text">
          {viewState.message}
        </div>
      )}

      {viewState?.canRetry && typeof onRetry === "function" && (
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
  return (
    <aside className="public-sign-sidebar">
      <div className="public-sign-summary">
        <div className="public-sign-section-label">Resumen</div>

        <div className="public-sign-summary__title" title={documentTitle}>
          {documentTitle}
        </div>

        <div className="public-sign-summary__text">
          Revisa la información principal antes de confirmar la acción sobre el
          documento.
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

      {showInlineStatus && (
        <PublicStatusMessageCard
          viewState={viewState}
          onRetry={onRetry}
          variant={getMessageVariant(viewState.kind)}
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
            No hay una vista previa disponible en este momento. Si el enlace lo
            permite, puedes abrir el documento completo en una nueva pestaña.
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

  const isLoading = viewState.kind === "loading";

  const isTerminal = useMemo(
    () => TERMINAL_VIEW_STATES.has(viewState.kind),
    [viewState.kind]
  );

  const isTerminalWithoutDocument = useMemo(
    () => isTerminal && !canRenderDocument,
    [isTerminal, canRenderDocument]
  );

  const introTitle = useMemo(() => {
    if (isTerminal) {
      if (viewState.title) return viewState.title;

      if (viewState.kind === "expired") {
        return "Enlace expirado";
      }

      if (viewState.kind === "invalid") {
        return "Enlace no válido";
      }

      if (viewState.kind === "rejected") {
        return "Documento rechazado";
      }

      if (viewState.kind === "completed" || viewState.kind === "used") {
        return isVisado
          ? "Documento visado correctamente"
          : "Acción registrada correctamente";
      }

      return "Portal de firma";
    }

    if (viewState.kind !== "ready" && viewState.title) {
      return viewState.title;
    }

    if (isVisado) {
      return "Revisa este documento para registrar tu visado";
    }

    if (signerRoleLabel === "Firmante final") {
      return "Revisa este documento para registrar tu firma final";
    }

    return "Revisa este documento para registrar tu firma";
  }, [isTerminal, viewState.title, viewState.kind, isVisado, signerRoleLabel]);

  const introText = useMemo(() => {
    if (isTerminal) {
      if (viewState.message) return viewState.message;

      if (viewState.kind === "expired") {
        return "Este enlace de firma expiró. Pide al remitente que te envíe un nuevo enlace.";
      }

      if (viewState.kind === "invalid") {
        return "Este enlace no es válido o podría estar incompleto. Verifica el link o pide uno nuevo.";
      }

      if (viewState.kind === "rejected") {
        return "Este documento fue rechazado y el flujo de firma quedó cerrado.";
      }

      if (viewState.kind === "completed" || viewState.kind === "used") {
        return isVisado
          ? "El documento fue visado correctamente desde este enlace público y quedó habilitado para continuar con la firma."
          : "La acción se registró correctamente sobre este documento.";
      }

      if (viewState.kind === "error") {
        return "Ocurrió un problema al cargar el documento. Intenta nuevamente o contacta al remitente.";
      }

      if (viewState.kind === "blocked_by_review") {
        return "El documento está en revisión por parte del emisor. Por ahora no se pueden registrar nuevas acciones desde este enlace.";
      }

      return "No hay más acciones disponibles para este enlace público.";
    }

    if (viewState.kind !== "ready" && viewState.message) {
      return viewState.message;
    }

    if (isVisado) {
      return "Cuando confirmes el visado, el documento quedará habilitado para continuar con la firma.";
    }

    return "Lee el documento completo, valida la información y luego confirma la acción correspondiente.";
  }, [isTerminal, viewState.message, viewState.kind, isVisado]);

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