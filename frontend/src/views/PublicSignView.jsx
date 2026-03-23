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
  const pdfUrl = publicSignPdfUrl || "";

  const document = publicSignDoc?.document || null;
  const signer = publicSignDoc?.signer || null;

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
    if (isVisado) return "No se pudo registrar el visado.";
    return "No se pudo registrar la firma.";
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

      const res = await fetch(
        `${API_URL}/public/docs/${publicSignToken}/${actionPath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

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
        `${API_URL}/public/docs/${publicSignToken}/rechazar`,
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
          maxWidth: 640,
          margin: "0 auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        }}
      >
        <PublicHeader />

        {/* Título principal */}
        <h1
          style={{
            textAlign: "center",
            color: isVisado ? "#b45309" : "#1e3a8a",
            marginBottom: 16,
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
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
            borderRadius: 12,
            backgroundColor: isVisado ? "#fffbeb" : "#eff6ff",
            border: `2px solid ${isVisado ? "#f59e0b" : "#3b82f6"}`,
            color: isVisado ? "#92400e" : "#1e3a8a",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {isVisado ? (
            <>
              <strong>Estás VISANDO este documento.</strong>{" "}
              El visado deja constancia de que revisaste y validaste su
              contenido, pero no equivale a la firma definitiva del
              representante legal.
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
              color: "#64748b",
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
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
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
              backgroundColor: "#fef2f2",
              border: "2px solid #fecaca",
              color: "#b91c1c",
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
                borderRadius: 8,
                backgroundColor: "#0f172a",
                color: "#e5e7eb",
                border: "none",
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
                background: "#f9fafb",
                padding: 20,
                borderRadius: 12,
                marginBottom: 24,
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  DOCUMENTO
                </label>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#111827",
                  }}
                >
                  {document.title}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    EMPRESA
                  </label>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#374151",
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
                        color: "#6b7280",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      FIRMANDO COMO
                    </label>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {signer.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                      }}
                    >
                      {signer.email}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón ver PDF */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-main"
                style={{
                  textDecoration: "none",
                  display: "inline-block",
                  width: "100%",
                  maxWidth: 400,
                  padding: "14px 24px",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                📄 Ver documento completo (PDF)
              </a>
            </div>

            {/* Aviso legal */}
            {canActOnDocument && (
              <>
                <ElectronicSignatureNotice
                  mode={isVisado ? "visado" : "firma"}
                  checked={acceptedLegal}
                  onChange={setAcceptedLegal}
                />

                {legalError && (
                  <p
                    style={{
                      color: "#b91c1c",
                      fontSize: 13,
                      marginBottom: 12,
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "#fee2e2",
                      borderRadius: 6,
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
                  background: "#fef2f2",
                  borderRadius: 8,
                  border: "2px solid #fecaca",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#b91c1c",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  ❌ Este documento fue rechazado
                </p>
                <p
                  style={{
                    color: "#7f1d1d",
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
                  background: "#f0fdf4",
                  borderRadius: 8,
                  border: "2px solid #86efac",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#16a34a",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  ✅ Documento firmado completamente
                </p>
                <p
                  style={{
                    color: "#15803d",
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
                  background: "#f0fdf4",
                  borderRadius: 8,
                  border: "2px solid #86efac",
                  marginTop: 16,
                }}
              >
                <p
                  style={{
                    color: "#16a34a",
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
                    borderRadius: 8,
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
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      border: "2px solid #fecaca",
                      borderRadius: 8,
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
                  borderRadius: 12,
                  backgroundColor: "#fef2f2",
                  border: "2px solid "#fecaca",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 12,
                    fontSize: "1.1rem",
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  ❌ Rechazar documento
                </h2>
                <p
                  style={{
                    marginBottom: 12,
                    color: "#7f1d1d",
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
                    borderRadius: 8,
                    border: "2px solid #fecaca",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    marginBottom: 12,
                  }}
                  placeholder="Escribe aquí el motivo de rechazo…"
                />

                {rejectError && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      fontSize: "0.85rem",
                      color: "#b91c1c",
                      background: "#fee2e2",
                      borderRadius: 6,
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
                      borderRadius: 8,
                      border: "2px solid #e5e7eb",
                      backgroundColor: "#ffffff",
                      color: "#374151",
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
                      borderRadius: 8,
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
