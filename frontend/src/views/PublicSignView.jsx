// src/views/PublicSignView.jsx
import React, { useState } from "react";
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

  const document =
    publicSignDoc?.document ||
    publicSignDoc ||
    null;

  const signer =
    publicSignDoc?.signer ||
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
    !isVisado && signer && signer.status === "FIRMADO";

  const docFullySigned =
    !isVisado && document && document.status === "FIRMADO";

  const docRejected = document && document.status === "RECHAZADO";

  const canActOnDocument =
    document &&
    !publicSignLoading &&
    !publicSignError &&
    !docFullySigned &&
    !alreadySignedByThisSigner &&
    !docRejected;

  const showSkeleton = publicSignLoading && !document && !publicSignError;

  function getDefaultErrorMessage() {
    return isVisado
      ? "No se pudo registrar el visado."
      : "No se pudo registrar la firma.";
  }

  async function handleConfirm() {
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

      const endpoint = isVisado
        ? `${API_URL}/public/docs/document/${publicSignToken}/${actionPath}`
        : `${API_URL}/public/docs/document/${publicSignToken}/${actionPath}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || getDefaultErrorMessage());
      }

      alert(
        isVisado
          ? "✅ Visado registrado correctamente."
          : "✅ Firma registrada correctamente."
      );

      await cargarFirmaPublica(publicSignToken);
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
    try {
      setRejectError("");

      const motivo = (rejectReason || "").trim();
      if (!motivo) {
        setRejectError("Debes ingresar un motivo de rechazo.");
        return;
      }

      setRejecting(true);

      const res = await fetch(
        `${API_URL}/public/docs/document/${publicSignToken}/rechazar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "No se pudo registrar el rechazo del documento."
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

  return (
    <div
      className="login-bg"
      style={{ minHeight: "100vh", padding: "20px 16px" }}
    >
      <div
        className="login-card"
        style={{
          maxWidth: 840,
          margin: "0 auto",
          background: "#020617",
          color: "#e5e7eb",
          borderRadius: 24,
          border: "1px solid #1f2937",
          boxShadow: "0 26px 70px rgba(15,23,42,0.95)",
        }}
      >
        <PublicHeader />

        {/* Título principal */}
        <h1
          style={{
            textAlign: "center",
            color: isVisado ? "#fbbf24" : "#60a5fa",
            marginBottom: 16,
            fontSize: "clamp(1.6rem, 4vw, 2.1rem)",
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {isVisado ? "📝 Visado de documento" : "✍️ Firma de documento"}
        </h1>

        {/* Aviso principal */}
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 14,
            backgroundColor: isVisado ? "#451a03" : "#0b1120",
            border: `1px solid ${isVisado ? "#fbbf24" : "#60a5fa"}`,
            color: "#e5e7eb",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {isVisado ? (
            <>
              <strong>Estás VISANDO este documento.</strong> El visado deja
              constancia de que revisaste y validaste su contenido, pero no
              equivale a la firma definitiva del representante legal.
            </>
          ) : (
            <>
              <strong>Estás FIRMANDO electrónicamente este documento.</strong>{" "}
              Esta acción corresponde a la aceptación y firma definitiva del
              contenido del documento.
            </>
          )}
        </div>

        {/* Loader */}
        {showSkeleton && (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <div
              style={{
                marginBottom: 8,
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Cargando información del documento…
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Esto puede tardar unos segundos, no cierres esta ventana.
            </div>
          </div>
        )}

        {/* Error al cargar documento */}
        {publicSignError && (
          <div
            style={{
              marginTop: 12,
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: "#450a0a",
              border: "1px solid #fecaca",
              color: "#fecaca",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
                fontSize: "1rem",
              }}
            >
              ❌ No se pudo cargar el documento
            </div>
            <div
              style={{
                marginBottom: 12,
                fontSize: "0.9rem",
              }}
            >
              {publicSignError}
            </div>
            <button
              type="button"
              className="btn-main"
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                backgroundColor: "#0f172a",
                color: "#e5e7eb",
                border: "1px solid #1f2937",
                width: "100%",
              }}
              onClick={() => cargarFirmaPublica(publicSignToken)}
              disabled={publicSignLoading}
            >
              🔄 Reintentar carga
            </button>
          </div>
        )}

        {/* Contenido principal */}
        {document && !publicSignLoading && !publicSignError && (
          <>
            {/* Info del documento */}
            <div
              style={{
                background: "#020617",
                padding: 20,
                borderRadius: 16,
                marginBottom: 24,
                border: "1px solid #1f2937",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: 4,
                    letterSpacing: "0.08em",
                  }}
                >
                  DOCUMENTO
                </label>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#f9fafb",
                  }}
                >
                  {document.title}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                  gap: 12,
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: 4,
                      letterSpacing: "0.08em",
                    }}
                  >
                    EMPRESA
                  </label>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#e5e7eb",
                    }}
                  >
                    {document.destinatario_nombre}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#9ca3af",
                    }}
                  >
                    RUT: {document.empresa_rut}
                  </div>
                </div>

                {!isVisado && signer && (
                  <div>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                        display: "block",
                        marginBottom: 4,
                        letterSpacing: "0.08em",
                      }}
                    >
                      FIRMANDO COMO
                    </label>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#e5e7eb",
                      }}
                    >
                      {signer?.name || signer?.nombre || "Firmante"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                      }}
                    >
                      {signer?.email || "Sin correo disponible"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón ver PDF */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-main btn-primary"
                  style={{
                    textDecoration: "none",
                    display: "inline-block",
                    width: "100%",
                    maxWidth: 420,
                    padding: "14px 24px",
                    borderRadius: 999,
                  }}
                >
                  📄 Ver documento completo (PDF)
                </a>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                  No se pudo cargar el PDF adjunto.
                </p>
              )}
            </div>

            {/* Aviso legal (con scroll interno) */}
            {canActOnDocument && (
              <>
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: "#020617",
                    border: "1px solid #1f2937",
                    maxHeight: 260,
                    overflowY: "auto",
                  }}
                >
                  <ElectronicSignatureNotice
                    mode={isVisado ? "visado" : "firma"}
                    checked={acceptedLegal}
                    onChange={setAcceptedLegal}
                  />
                </div>

                {legalError && (
                  <p
                    style={{
                      color: "#fecaca",
                      fontSize: 13,
                      marginBottom: 12,
                      padding: "8px 12px",
                      background: "#450a0a",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                    }}
                  >
                    ⚠️ {legalError}
                  </p>
                )}
              </>
            )}

            {/* Mensajes de estado */}
            {docRejected && (
              <div
                style={{
                  textAlign: "center",
                  padding: 16,
                  background: "#450a0a",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#fecaca",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  ❌ Este documento fue rechazado
                </p>
                <p
                  style={{
                    color: "#fecaca",
                    fontSize: "0.9rem",
                    margin: "8px 0 0",
                  }}
                >
                  No es posible firmarlo ni modificar su estado.
                </p>
              </div>
            )}

            {docFullySigned && !docRejected && (
              <div
                style={{
                  textAlign: "center",
                  padding: 16,
                  background: "#022c22",
                  borderRadius: 10,
                  border: "1px solid #22c55e",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#bbf7d0",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  ✅ Documento firmado completamente
                </p>
                <p
                  style={{
                    color: "#6ee7b7",
                    fontSize: "0.9rem",
                    margin: "8px 0 0",
                  }}
                >
                  Todos los firmantes han completado el proceso.
                </p>
              </div>
            )}

            {alreadySignedByThisSigner && !docRejected && !docFullySigned && (
              <div
                style={{
                  textAlign: "center",
                  padding: 16,
                  background: "#022c22",
                  borderRadius: 10,
                  border: "1px solid #22c55e",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#bbf7d0",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  ✅ Ya has firmado este documento
                </p>
              </div>
            )}

            {/* Botones de acción */}
            {canActOnDocument && !showReject && (
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <button
                  className="btn-main btn-primary"
                  style={{
                    width: "100%",
                    padding: "16px 24px",
                    fontSize: "1rem",
                    fontWeight: 700,
                    borderRadius: 999,
                    opacity: signing || !acceptedLegal ? 0.6 : 1,
                    cursor:
                      signing || !acceptedLegal ? "not-allowed" : "pointer",
                  }}
                  onClick={handleConfirm}
                  disabled={signing || !acceptedLegal}
                >
                  {signing
                    ? "⏳ Procesando..."
                    : isVisado
                    ? "✓ VISAR DOCUMENTO"
                    : "✍️ FIRMAR DOCUMENTO"}
                </button>

                {!isVisado && (
                  <button
                    type="button"
                    className="btn-main"
                    style={{
                      width: "100%",
                      padding: "12px 24px",
                      backgroundColor: "#450a0a",
                      color: "#fecaca",
                      border: "1px solid #fecaca",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      setShowReject(true);
                      setRejectError("");
                    }}
                  >
                    ✕ Rechazar documento
                  </button>
                )}
              </div>
            )}

            {/* Panel de rechazo */}
            {showReject && (
              <div
                style={{
                  marginTop: 24,
                  padding: 20,
                  borderRadius: 16,
                  backgroundColor: "#450a0a",
                  border: "1px solid #fecaca",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 12,
                    fontSize: "1.1rem",
                    color: "#fecaca",
                    fontWeight: 700,
                  }}
                >
                  ❌ Rechazar documento
                </h2>
                <p
                  style={{
                    marginBottom: 12,
                    color: "#fecaca",
                    fontSize: "0.9rem",
                    lineHeight: 1.6,
                  }}
                >
                  Indica brevemente el motivo por el cual rechazas este
                  documento. Esta información será enviada al emisor y quedará
                  registrada en el historial.
                </p>

                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #fecaca",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    marginBottom: 12,
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                  placeholder="Escribe aquí el motivo de rechazo…"
                />

                {rejectError && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      fontSize: "0.85rem",
                      color: "#fecaca",
                      background: "#7f1d1d",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                    }}
                  >
                    ⚠️ {rejectError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn-main"
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: "12px 20px",
                      borderRadius: 999,
                      border: "1px solid #1f2937",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      setShowReject(false);
                      setRejectReason("");
                      setRejectError("");
                    }}
                    disabled={rejecting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-main"
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: "12px 20px",
                      borderRadius: 999,
                      backgroundColor: "#b91c1c",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      opacity: rejecting ? 0.6 : 1,
                      cursor: rejecting ? "not-allowed" : "pointer",
                    }}
                    onClick={handleReject}
                    disabled={rejecting}
                  >
                    {rejecting ? "⏳ Enviando..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <PublicFooter />
      </div>
    </div>
  );
}