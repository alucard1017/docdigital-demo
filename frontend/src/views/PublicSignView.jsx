import React, { useMemo, useState } from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";

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
  const isVisado = publicSignMode === "visado";

  const document = publicSignDoc?.document || publicSignDoc || null;

  const signer =
    publicSignDoc?.signer ||
    publicSignDoc?.currentSigner ||
    (Array.isArray(publicSignDoc?.signers) ? publicSignDoc.signers[0] : null) ||
    null;

  const pdfUrl =
    publicSignPdfUrl ||
    publicSignDoc?.pdfUrl ||
    publicSignDoc?.document?.pdf_url ||
    publicSignDoc?.document?.pdfUrl ||
    "";

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [signing, setSigning] = useState(false);

  const alreadySignedByThisSigner =
    !isVisado &&
    signer &&
    (signer.status === "FIRMADO" || signer.signer_status === "FIRMADO");

  const docFullySigned =
    !isVisado && document && document.status === "FIRMADO";

  const docRejected = document && document.status === "RECHAZADO";

  const canActOnDocument =
    !!document &&
    !publicSignLoading &&
    !publicSignError &&
    !docFullySigned &&
    !alreadySignedByThisSigner &&
    !docRejected;

  const showSkeleton = publicSignLoading && !document && !publicSignError;

  const titleText = isVisado ? "Visado de documento" : "Firma electrónica";

  const statusBadge = useMemo(() => {
    if (docRejected) {
      return {
        label: "Rechazado",
        className: "public-sign-status public-sign-status--danger",
      };
    }

    if (docFullySigned) {
      return {
        label: "Completado",
        className: "public-sign-status public-sign-status--success",
      };
    }

    if (alreadySignedByThisSigner) {
      return {
        label: "Ya firmado",
        className: "public-sign-status public-sign-status--success",
      };
    }

    return {
      label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
      className: isVisado
        ? "public-sign-status public-sign-status--warning"
        : "public-sign-status public-sign-status--info",
    };
  }, [alreadySignedByThisSigner, docFullySigned, docRejected, isVisado]);

  function getDefaultErrorMessage() {
    return isVisado
      ? "No se pudo registrar el visado."
      : "No se pudo registrar la firma.";
  }

  async function handleConfirm() {
    if (signing || !canActOnDocument) return;

    try {
      if (!acceptedLegal) {
        setLegalError(
          isVisado
            ? "Debes aceptar el aviso legal de visado antes de continuar."
            : "Debes aceptar el aviso legal de firma electrónica antes de continuar."
        );
        return;
      }

      setLegalError("");
      setSigning(true);

      const actionPath = isVisado ? "visar" : "firmar";
      const endpoint = `${API_URL}/public/docs/${publicSignToken}/${actionPath}`;

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
        throw new Error(data?.message || getDefaultErrorMessage());
      }

      await cargarFirmaPublica(publicSignToken);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      alert(
        isVisado
          ? "✅ Visado registrado correctamente."
          : "✅ Firma registrada correctamente."
      );
    } catch (err) {
      alert(
        "❌ " +
          (err?.message ||
            "Ocurrió un error al procesar la acción. Intenta nuevamente.")
      );
    } finally {
      setSigning(false);
    }
  }

  async function handleReject() {
    if (rejecting || !canActOnDocument) return;

    try {
      setRejectError("");

      const motivo = (rejectReason || "").trim();

      if (!motivo) {
        setRejectError("Debes ingresar un motivo de rechazo.");
        return;
      }

      setRejecting(true);

      const res = await fetch(
        `${API_URL}/public/docs/${publicSignToken}/rechazar`,
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
        throw new Error(
          data?.message || "No se pudo registrar el rechazo del documento."
        );
      }

      alert("✅ Documento rechazado correctamente.");

      await cargarFirmaPublica(publicSignToken);
      setShowReject(false);
      setRejectReason("");
      setRejectError("");
    } catch (err) {
      setRejectError(
        err?.message ||
          "Error al registrar el rechazo. Intenta nuevamente."
      );
    } finally {
      setRejecting(false);
    }
  }

  function handleToggleReject() {
    setShowReject((prev) => !prev);
    setRejectReason("");
    setRejectError("");
  }

  return (
    <div className="login-bg public-sign-page">
      <div className="public-sign-shell">
        <PublicHeader />

        <div className="public-sign-heading">
          <div>
            <div className="public-sign-eyebrow">VeriFirma · Portal público</div>
            <h1 className="public-sign-title">{titleText}</h1>
          </div>

          <div className={statusBadge.className}>{statusBadge.label}</div>
        </div>

        <div
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
            {isVisado
              ? "Estás revisando y visando este documento"
              : "Estás firmando electrónicamente este documento"}
          </div>

          <div className="public-sign-intro__text">
            {isVisado
              ? "Tu visado deja constancia de que revisaste el contenido y autorizas la continuidad del flujo. No reemplaza la firma final del representante."
              : "Esta acción representa la aceptación definitiva del contenido del documento mediante firma electrónica simple, con trazabilidad del proceso."}
          </div>
        </div>

        {showSkeleton && (
          <div className="public-sign-message-card">
            <div className="spinner public-sign-spinner" />
            <div className="public-sign-message-card__title">
              Cargando documento…
            </div>
            <div className="public-sign-message-card__text">
              Estamos preparando la vista pública del documento.
            </div>
          </div>
        )}

        {publicSignError && (
          <div className="public-sign-message-card public-sign-message-card--error">
            <div className="public-sign-message-card__title">
              No se pudo cargar el documento
            </div>

            <div className="public-sign-message-card__text">
              {publicSignError}
            </div>

            <button
              type="button"
              className="public-sign-button public-sign-button--secondary public-sign-button--auto"
              onClick={() => cargarFirmaPublica(publicSignToken)}
              disabled={publicSignLoading}
            >
              Reintentar carga
            </button>
          </div>
        )}

        {document && !publicSignLoading && !publicSignError && (
          <div className="public-sign-layout">
            {/* Documento primero, a ancho completo */}
            <section className="public-sign-document-panel">
              <div className="public-sign-document-panel__header">
                <div>
                  <div className="public-sign-section-label">Documento</div>
                  <div className="public-sign-document-title">
                    {document.title || "Documento"}
                  </div>
                </div>

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-sign-open-pdf"
                  >
                    Abrir PDF en nueva pestaña
                  </a>
                )}
              </div>

              <div className="public-sign-pdf-stage">
                {pdfUrl ? (
                  <iframe
                    title="Vista previa del documento"
                    src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH&zoom=page-width`}
                    className="public-sign-pdf-frame"
                  />
                ) : (
                  <div className="public-sign-pdf-empty">
                    No se pudo mostrar la vista previa del PDF.
                  </div>
                )}
              </div>
            </section>

            {/* Panel lateral debajo en mobile, a la derecha en desktop grande */}
            <aside className="public-sign-sidebar">
              <div className="public-sign-summary">
                <div className="public-sign-section-label">Resumen</div>
                <div className="public-sign-summary__title">
                  {document.title || "Documento"}
                </div>
                <div className="public-sign-summary__text">
                  Revisa el documento completo antes de continuar. El detalle
                  legal y las acciones se mantienen en este panel para ofrecer
                  una experiencia clara y ordenada.
                </div>
              </div>

              <div className="public-sign-meta-grid">
                <div className="public-sign-meta-card">
                  <div className="public-sign-meta-card__label">Empresa</div>
                  <div className="public-sign-meta-card__value">
                    {document.destinatario_nombre || "No informado"}
                  </div>
                  <div className="public-sign-meta-card__subvalue">
                    RUT: {document.empresa_rut || "No informado"}
                  </div>
                </div>

                {!isVisado && signer && (
                  <div className="public-sign-meta-card">
                    <div className="public-sign-meta-card__label">
                      Firmando como
                    </div>
                    <div className="public-sign-meta-card__value">
                      {signer?.name ||
                        signer?.nombre ||
                        signer?.signer_name ||
                        "Firmante"}
                    </div>
                    <div className="public-sign-meta-card__subvalue">
                      {signer?.email ||
                        signer?.signer_email ||
                        "Sin correo disponible"}
                    </div>
                  </div>
                )}
              </div>

              {canActOnDocument && (
                <>
                  <ElectronicSignatureNotice
                    mode={isVisado ? "visado" : "firma"}
                    checked={acceptedLegal}
                    onChange={(value) => {
                      setAcceptedLegal(value);
                      if (value) setLegalError("");
                    }}
                  />

                  {legalError && (
                    <div className="public-sign-inline-error">
                      {legalError}
                    </div>
                  )}
                </>
              )}

              {docRejected && (
                <div className="public-sign-state-box public-sign-state-box--danger">
                  <div className="public-sign-state-box__title">
                    Este documento fue rechazado
                  </div>
                  <div className="public-sign-state-box__text">
                    Ya no es posible firmarlo ni cambiar su estado desde este
                    enlace.
                  </div>
                </div>
              )}

              {docFullySigned && !docRejected && (
                <div className="public-sign-state-box public-sign-state-box--success">
                  <div className="public-sign-state-box__title">
                    Documento firmado completamente
                  </div>
                  <div className="public-sign-state-box__text">
                    Todos los participantes completaron el proceso.
                  </div>
                </div>
              )}

              {alreadySignedByThisSigner && !docRejected && !docFullySigned && (
                <div className="public-sign-state-box public-sign-state-box--success">
                  <div className="public-sign-state-box__title">
                    Ya registraste tu firma en este documento
                  </div>
                  <div className="public-sign-state-box__text">
                    Este enlace ya fue utilizado correctamente para tu
                    participación.
                  </div>
                </div>
              )}

              {canActOnDocument && !showReject && (
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
                      ? "Visar documento"
                      : "Firmar documento"}
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
                    Indica el motivo del rechazo. Esta observación quedará
                    registrada y será informada al emisor.
                  </p>

                  <textarea
                    rows={5}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="public-sign-textarea"
                    placeholder="Escribe aquí el motivo del rechazo..."
                    disabled={rejecting}
                  />

                  {rejectError && (
                    <div className="public-sign-inline-error">
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
            </aside>
          </div>
        )}

        <div className="public-sign-footer-wrap">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}