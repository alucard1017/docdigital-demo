import React, { useMemo } from "react";
import { ElectronicSignatureNotice } from "../../components/Legal/ElectronicSignatureNotice";

export function PublicSignActions({
  acceptedLegal,
  onChangeLegal,
  legalError,
  canSubmitAction,
  isVisado,
  signerRoleLabel,
  signing,
  rejecting,
  onConfirm,
  canReject,
  showReject,
  onToggleReject,
  rejectReason,
  onChangeRejectReason,
  rejectError,
  onReject,
}) {
  const actionLabel = useMemo(() => {
    if (signing) return "Procesando...";
    if (isVisado) return "Registrar visado";
    if (signerRoleLabel === "Firmante final") return "Registrar firma final";
    return "Registrar firma";
  }, [signing, isVisado, signerRoleLabel]);

  const helperText = useMemo(
    () =>
      `Al continuar, registrarás tu ${
        isVisado ? "visado" : "firma electrónica"
      }. Esta acción no se puede deshacer.`,
    [isVisado]
  );

  const submitBlocked =
    !acceptedLegal || !canSubmitAction || signing || rejecting;

  const rejectTextareaErrorId = "public-sign-reject-error";
  const actionHelpId = "public-sign-action-help";
  const actionErrorId = "public-sign-action-error";

  const actionAriaDescribedBy =
    !canSubmitAction || legalError
      ? `${actionHelpId} ${actionErrorId}`
      : actionHelpId;

  return (
    <div className="public-sign-action-block">
      <ElectronicSignatureNotice
        checked={acceptedLegal}
        onChange={onChangeLegal}
        mode={isVisado ? "visado" : "firma"}
      />

      {(legalError || !canSubmitAction) && (
        <div
          id={actionErrorId}
          className="public-sign-inline-error"
          role="alert"
          aria-live="polite"
        >
          {legalError ||
            "No se puede habilitar la acción para este enlace."}
        </div>
      )}

      <p id={actionHelpId} className="public-sign-helper-text">
        {helperText}
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
            onClick={onConfirm}
            disabled={submitBlocked}
            aria-describedby={actionAriaDescribedBy}
          >
            {actionLabel}
          </button>

          {canReject && (
            <button
              type="button"
              className="public-sign-button public-sign-button--danger"
              onClick={onToggleReject}
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
            onChange={(e) => onChangeRejectReason(e.target.value)}
            className="public-sign-textarea"
            placeholder="Escribe aquí el motivo del rechazo..."
            disabled={rejecting}
            aria-invalid={rejectError ? "true" : "false"}
            aria-describedby={rejectError ? rejectTextareaErrorId : undefined}
          />

          {rejectError && (
            <div
              id={rejectTextareaErrorId}
              className="public-sign-inline-error"
              role="alert"
              aria-live="polite"
            >
              {rejectError}
            </div>
          )}

          <div className="public-sign-reject-actions">
            <button
              type="button"
              className="public-sign-button public-sign-button--secondary"
              onClick={onToggleReject}
              disabled={rejecting}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="public-sign-button public-sign-button--danger-solid"
              onClick={onReject}
              disabled={rejecting || signing}
            >
              {rejecting ? "Enviando..." : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}