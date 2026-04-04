import React, { useMemo, useState } from "react";
import "./PublicSignView.css";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";

function stripTrailingSlashes(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizePublicApiBase(API_URL) {
  const raw = API_URL || import.meta.env.VITE_API_URL || "";
  const trimmed = stripTrailingSlashes(raw);
  if (!trimmed) return "";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
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

  const document = publicSignDoc?.document || publicSignDoc || null;

  const signer =
    publicSignDoc?.signer ||
    publicSignDoc?.currentSigner ||
    (Array.isArray(publicSignDoc?.signers) ? publicSignDoc.signers[0] : null) ||
    null;

  const pdfUrl =
    publicSignPdfUrl ||
    publicSignDoc?.pdfUrl ||
    publicSignDoc?.previewUrl ||
    publicSignDoc?.signedPdfUrl ||
    publicSignDoc?.document?.signedPdfUrl ||
    publicSignDoc?.document?.previewUrl ||
    publicSignDoc?.document?.pdf_final_url ||
    publicSignDoc?.document?.pdf_url ||
    "";

  const iframePdfUrl = pdfUrl ? `${pdfUrl}#zoom=page-width` : "";

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [signing, setSigning] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const alreadySignedByThisSigner =
    !isVisado &&
    signer &&
    (signer.status === "FIRMADO" || signer.signer_status === "FIRMADO");

  const docFullySigned = !isVisado && document?.status === "FIRMADO";
  const docRejected = document?.status === "RECHAZADO";
  const visadoDone = isVisado && document?.status !== "PENDIENTE_VISADO";

  const canActOnDocument =
    !!document &&
    !!publicSignToken &&
    !!API_BASE &&
    !publicSignLoading &&
    !publicSignError &&
    !docFullySigned &&
    !alreadySignedByThisSigner &&
    !docRejected &&
    !visadoDone;

  const showSkeleton = publicSignLoading && !document && !publicSignError;
  const titleText = isVisado ? "Visado de documento" : "Firma electrónica";

  const statusBadge = useMemo(() => {
    if (docRejected) {
      return {
        label: "Rechazado",
        className: "public-sign-status public-sign-status--danger",
      };
    }

    if (docFullySigned || alreadySignedByThisSigner) {
      return {
        label: docFullySigned ? "Completado" : "Ya firmado",
        className: "public-sign-status public-sign-status--success",
      };
    }

    if (visadoDone) {
      return {
        label: "Visado procesado",
        className: "public-sign-status public-sign-status--success",
      };
    }

    return {
      label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
      className: isVisado
        ? "public-sign-status public-sign-status--warning"
        : "public-sign-status public-sign-status--info",
    };
  }, [alreadySignedByThisSigner, docFullySigned, docRejected, isVisado, visadoDone]);

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

      setActionMessage("");
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
        throw new Error(data?.message || getDefaultErrorMessage());
      }

      await cargarFirmaPublica(publicSignToken);

      setActionMessage(
        data?.message ||
          (isVisado
            ? "Visado registrado correctamente."
            : "Firma registrada correctamente.")
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setActionMessage(
        `❌ ${
          err?.message ||
          "Ocurrió un error al procesar la acción. Intenta nuevamente."
        }`
      );
    } finally {
      setSigning(false);
    }
  }

  async function handleReject() {
    if (rejecting || !canActOnDocument) return;

    try {
      setRejectError("");
      setActionMessage("");

      const motivo = String(rejectReason || "").trim();

      if (!motivo) {
        setRejectError("Debes ingresar un motivo de rechazo.");
        return;
      }

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
        throw new Error(
          data?.message || "No se pudo registrar el rechazo del documento."
        );
      }

      await cargarFirmaPublica(publicSignToken);

      setActionMessage(data?.message || "Documento rechazado correctamente.");
      setShowReject(false);
      setRejectReason("");
      setRejectError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setRejectError(
        err?.message || "Error al registrar el rechazo. Intenta nuevamente."
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
              ? "Tu visado deja constancia de revisión y continuidad del flujo."
              : "Esta acción representa la aceptación del contenido mediante firma electrónica simple."}
          </div>
        </div>

        {actionMessage && (
          <div
            className={`public-sign-message-card ${
              actionMessage.startsWith("❌")
                ? "public-sign-message-card--error"
                : ""
            }`}
          >
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
                    Abrir PDF completo
                  </a>
                )}
              </div>

              <div className="public-sign-pdf-stage">
                {pdfUrl ? (
                  <iframe
                    title="Vista previa del documento"
                    src={iframePdfUrl}
                    className="public-sign-pdf-frame"
                  />
                ) : (
                  <div className="public-sign-pdf-empty">
                    No hay una vista previa disponible en este momento. Usa el
                    acceso directo al PDF completo cuando esté disponible.
                  </div>
                )}
              </div>
            </section>

            <aside className="public-sign-sidebar">
              <div className="public-sign-summary">
                <div className="public-sign-section-label">Resumen</div>
                <div className="public-sign-summary__title">
                  {document.title || "Documento"}
                </div>
                <div className="public-sign-summary__text">
                  Revisa el documento antes de continuar. Si la vista previa no
                  aparece o se ve mal, usa el acceso directo al PDF completo.
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
                    <div className="public-sign-inline-error">{legalError}</div>
                  )}
                </>
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
                    Indica el motivo del rechazo.
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
                    <div className="public-sign-inline-error">{rejectError}</div>
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