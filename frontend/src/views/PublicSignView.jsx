// frontend/src/views/PublicSignView.jsx
import React, { useMemo, useState } from "react";
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

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function classifyPublicError(error) {
  if (!error) {
    return {
      type: "generic",
      title: "No se pudo cargar el documento",
      message:
        "Ocurrió un problema al abrir este enlace. Intenta nuevamente en unos segundos.",
    };
  }

  const text = String(error).toLowerCase();

  if (text.includes("expir") || text.includes("expired")) {
    return {
      type: "expired",
      title: "Este enlace venció",
      message:
        "Este enlace de firma ya no está disponible. Solicita un nuevo enlace a la empresa que te envió el documento.",
    };
  }

  if (
    text.includes("token") ||
    text.includes("inválido") ||
    text.includes("invalido") ||
    text.includes("invalid")
  ) {
    return {
      type: "invalid",
      title: "Este enlace no es válido",
      message:
        "No pudimos validar este acceso. Abre el enlace completo desde tu correo o solicita uno nuevo.",
    };
  }

  if (
    text.includes("used") ||
    text.includes("ya fue usado") ||
    text.includes("already used") ||
    text.includes("ya fue firmado") ||
    text.includes("ya fue rechazado")
  ) {
    return {
      type: "used",
      title: "Este enlace ya no requiere acción",
      message:
        "El documento ya fue procesado con este enlace, por lo que no puedes realizar una nueva acción aquí.",
    };
  }

  return {
    type: "generic",
    title: "No se pudo cargar el documento",
    message:
      "Ocurrió un problema al abrir este enlace. Intenta nuevamente en unos segundos.",
  };
}

function resolvePublicFlowState({
  publicSignError,
  document,
  signerStatus,
  documentStatus,
  isVisado,
}) {
  if (publicSignError) {
    const classified = classifyPublicError(publicSignError);
    return {
      kind: classified.type,
      title: classified.title,
      message: classified.message,
      canRetryLoad: classified.type === "generic",
    };
  }

  const alreadySignedByThisSigner = !isVisado && signerStatus === "FIRMADO";
  const docFullySigned = !isVisado && documentStatus === "FIRMADO";
  const docRejected = documentStatus === "RECHAZADO";

  const visadoDone =
    isVisado &&
    documentStatus &&
    documentStatus !== "PENDIENTE_VISADO" &&
    documentStatus !== "PENDIENTE";

  if (!document) {
    return {
      kind: "loading-or-empty",
      title: "",
      message: "",
      canRetryLoad: false,
    };
  }

  if (docRejected) {
    return {
      kind: "rejected",
      title: "Este documento fue rechazado",
      message:
        "El flujo de firma se encuentra cerrado y este enlace ya no admite acciones.",
      canRetryLoad: false,
    };
  }

  if (docFullySigned) {
    return {
      kind: "completed",
      title: "Este documento ya fue firmado",
      message:
        "El proceso ya fue completado. No puedes realizar nuevas acciones desde este enlace.",
      canRetryLoad: false,
    };
  }

  if (alreadySignedByThisSigner) {
    return {
      kind: "used",
      title: "Tu firma ya fue registrada",
      message:
        "Este enlace ya fue utilizado anteriormente y no requiere una nueva acción.",
      canRetryLoad: false,
    };
  }

  if (visadoDone) {
    return {
      kind: "used",
      title: "El visado ya fue procesado",
      message:
        "La revisión de este documento ya fue registrada y este enlace no requiere otra acción.",
      canRetryLoad: false,
    };
  }

  return {
    kind: "pending",
    title: isVisado ? "Pendiente de visado" : "Pendiente de firma",
    message: isVisado
      ? "Revisa el documento y registra tu visado cuando estés listo."
      : "Revisa el documento y registra tu firma cuando estés listo.",
    canRetryLoad: false,
  };
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

  const document = useMemo(() => {
    return publicSignDoc?.document || publicSignDoc || null;
  }, [publicSignDoc]);

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
      documentMeta?.destinatario_nombre,
      documentMeta?.empresa_nombre,
      documentMeta?.nombre_empresa,
      documentMeta?.company_name,
      documentMeta?.companyName,
      documentMeta?.razon_social,
      signedDocument?.destinatario_nombre,
      signedDocument?.empresa_nombre,
      signedDocument?.nombre_empresa,
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
      documentMeta?.numeroContratoInterno,
      documentMeta?.numero_contrato_interno,
      documentMeta?.numero_contrato,
      documentMeta?.numeroContrato,
      signedDocument?.numero_contrato_interno,
      signedDocument?.numero_contrato,
      signedDocument?.numeroContrato,
      publicSignDoc?.numero_contrato_interno,
      publicSignDoc?.numero_contrato,
      publicSignDoc?.numeroContrato,
      "---------"
    );
  }, [document, documentMeta, signedDocument, publicSignDoc]);

  const signerName = useMemo(() => {
    return pickFirstNonEmpty(
      signer?.name,
      signer?.nombre,
      signer?.signer_name,
      signer?.full_name,
      signer?.fullname,
      "Firmante"
    );
  }, [signer]);

  const signerEmail = useMemo(() => {
    return pickFirstNonEmpty(
      signer?.email,
      signer?.signer_email,
      signer?.correo,
      signer?.mail,
      "Sin correo disponible"
    );
  }, [signer]);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [signing, setSigning] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

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

  const alreadySignedByThisSigner = !isVisado && signerStatus === "FIRMADO";
  const docFullySigned = !isVisado && documentStatus === "FIRMADO";
  const docRejected = documentStatus === "RECHAZADO";

  const visadoDone =
    isVisado &&
    documentStatus &&
    documentStatus !== "PENDIENTE_VISADO" &&
    documentStatus !== "PENDIENTE";

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

    if (publicSignError) {
      const classified = classifyPublicError(publicSignError);

      if (classified.type === "expired") {
        return {
          label: "Enlace vencido",
          className: "public-sign-status public-sign-status--danger",
        };
      }

      if (classified.type === "invalid") {
        return {
          label: "Enlace inválido",
          className: "public-sign-status public-sign-status--danger",
        };
      }

      if (classified.type === "used") {
        return {
          label: "Sin acción",
          className: "public-sign-status public-sign-status--warning",
        };
      }

      return {
        label: "Error de carga",
        className: "public-sign-status public-sign-status--danger",
      };
    }

    return {
      label: isVisado ? "Pendiente de visado" : "Pendiente de firma",
      className: isVisado
        ? "public-sign-status public-sign-status--warning"
        : "public-sign-status public-sign-status--info",
    };
  }, [
    alreadySignedByThisSigner,
    docFullySigned,
    docRejected,
    isVisado,
    publicSignError,
    visadoDone,
  ]);

  const publicFlowState = useMemo(
    () =>
      resolvePublicFlowState({
        publicSignError,
        document,
        signerStatus,
        documentStatus,
        isVisado,
      }),
    [publicSignError, document, signerStatus, documentStatus, isVisado]
  );

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

  const showCompletedInfo =
    !canActOnDocument &&
    document &&
    !publicSignLoading &&
    !publicSignError &&
    (docFullySigned || alreadySignedByThisSigner || docRejected || visadoDone);

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
        {isVisado ? "visado" : "firma electrónica"} sobre este documento. Esta
        acción no se puede deshacer.
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
            Explica brevemente el motivo. Esta información puede ser compartida
            con la empresa que te envió el documento.
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
            {isVisado
              ? "Estás revisando este documento para registrar tu visado"
              : "Estás revisando este documento para registrar tu firma"}
          </div>

          <div className="public-sign-intro__text">
            {isVisado
              ? "Lee el contenido y, si todo está correcto, registra tu visado para que el flujo continúe."
              : "Lee el contenido y, si estás de acuerdo, registra tu firma electrónica simple."}
          </div>
        </section>

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
              Estamos preparando la vista del documento para que puedas revisarlo.
            </div>
          </div>
        )}

        {publicSignError && (
          <div className="public-sign-message-card public-sign-message-card--error">
            <div className="public-sign-message-card__title">
              {publicFlowState.title}
            </div>
            <div className="public-sign-message-card__text">
              {publicFlowState.message}
            </div>

            {publicFlowState.canRetryLoad && (
              <button
                type="button"
                className="public-sign-button public-sign-button--secondary public-sign-button--auto"
                onClick={() => cargarFirmaPublica(publicSignToken)}
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
                  Revisa la información principal y luego abre el documento completo
                  para confirmar su contenido antes de continuar.
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
                    {document?.numero_contrato_interno ||
                      document?.numero_contrato ||
                      contractNumber ||
                      "---------"}
                  </div>
                </div>

                {!isVisado && signer && (
                  <div className="public-sign-meta-card">
                    <div className="public-sign-meta-card__label">
                      Firmando como
                    </div>
                    <div className="public-sign-meta-card__value">{signerName}</div>
                    <div className="public-sign-meta-card__subvalue">
                      {signerEmail}
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

              {showCompletedInfo && (
                <div className="public-sign-message-card public-sign-message-card--info">
                  <div className="public-sign-message-card__title">
                    {publicFlowState.title}
                  </div>
                  <div className="public-sign-message-card__text">
                    {publicFlowState.message}
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
                    No hay una vista previa disponible en este momento. Si el enlace
                    está habilitado, puedes abrir el documento completo en una nueva
                    pestaña.
                  </div>
                )}
              </div>

              <div className="public-sign-mobile-actions">
                {ActionBlock}
              </div>
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