import React from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { PublicPdfViewer } from "../components/PublicPdfViewer";
import { PublicSignActions } from "./publicSign/PublicSignActions";
import { usePublicSignLogic, buildMetaTitle } from "./publicSign/usePublicSignLogic";

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

  const actionBlock = canRenderActions ? (
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

        {["invalid", "expired", "used", "rejected", "completed", "error", "blocked_by_review"].includes(
          viewState.kind
        ) &&
          !canRenderDocument && (
            <div
              className={`public-sign-message-card ${
                viewState.kind === "error" ||
                viewState.kind === "invalid" ||
                viewState.kind === "expired" ||
                viewState.kind === "rejected" ||
                viewState.kind === "blocked_by_review"
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