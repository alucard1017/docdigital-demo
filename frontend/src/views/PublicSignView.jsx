// src/views/PublicSignView.jsx
import React, { useState } from "react";

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,      // { document, signer }
  publicSignPdfUrl,
  publicSignToken,    // token = sign_token del firmante, o signature_token para visado
  publicSignMode,     // "visado" o null
  API_URL,
  cargarFirmaPublica, // GET /api/public/docs/:token
}) {
  const pdfUrl = publicSignPdfUrl || "";
  const isVisado = publicSignMode === "visado";

  const document = publicSignDoc?.document || null;
  const signer = publicSignDoc?.signer || null;

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  async function handleConfirm() {
    try {
      const actionPath = isVisado ? "visar" : "firmar";

      const res = await fetch(
        `${API_URL}/api/public/docs/${publicSignToken}/${actionPath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            (isVisado
              ? "No se pudo registrar el visado"
              : "No se pudo registrar la firma")
        );
      }

      alert(
        isVisado
          ? "✅ Visado registrado correctamente"
          : "✅ Firma registrada correctamente"
      );

      await cargarFirmaPublica(publicSignToken);
    } catch (err) {
      alert("❌ " + (err.message || "Ocurrió un error al procesar la acción."));
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
        `${API_URL}/api/public/docs/${publicSignToken}/rechazar`,
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
      setRejectError(err.message || "Error al registrar el rechazo.");
    } finally {
      setRejecting(false);
    }
  }

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

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 800 }}>
        <h1
          style={{
            textAlign: "center",
            color: isVisado ? "#b45309" : "#1e3a8a",
            marginBottom: 10,
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          {isVisado ? "Visado de Documento" : "Firma de Documento"}
        </h1>

        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 8,
            backgroundColor: isVisado ? "#fffbeb" : "#eff6ff",
            border: `1px solid ${isVisado ? "#f59e0b" : "#3b82f6"}`,
            color: isVisado ? "#92400e" : "#1e3a8a",
            fontSize: "0.9rem",
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

        {publicSignLoading && (
          <p style={{ textAlign: "center", marginTop: 20 }}>
            Cargando información del documento…
          </p>
        )}

        {publicSignError && (
          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              color: "#b91c1c",
              fontWeight: 600,
            }}
          >
            {publicSignError}
          </p>
        )}

        {document && !publicSignLoading && !publicSignError && (
          <>
            <p
              style={{
                textAlign: "center",
                color: "#64748b",
                marginBottom: 20,
              }}
            >
              Documento: <strong>{document.title}</strong>
              <br />
              Empresa:{" "}
              <strong>{document.destinatario_nombre}</strong> (RUT{" "}
              {document.empresa_rut})
            </p>

            {!isVisado && signer && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  marginBottom: 10,
                  textAlign: "center",
                }}
              >
                Estás firmando como:{" "}
                <strong>{signer.name}</strong> ({signer.email})
              </p>
            )}

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-main btn-primary"
                style={{ textDecoration: "none" }}
              >
                Ver documento en PDF
              </a>
            </div>

            {!isVisado && document.firmante_nombre && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  marginBottom: 20,
                }}
              >
                Representante legal principal:{" "}
                <strong>{document.firmante_nombre}</strong> (RUN{" "}
                {document.firmante_run})
              </p>
            )}

            {docRejected && (
              <p
                style={{
                  textAlign: "center",
                  color: "#b91c1c",
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Este documento fue rechazado. No es posible firmarlo ni
                modificar su estado.
              </p>
            )}

            {isVisado ? (
              document.signature_status === "FIRMADO" && !docRejected ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#16a34a",
                    fontWeight: 700,
                    marginTop: 10,
                  }}
                >
                  Este documento ya fue firmado, no es posible modificar su
                  estado.
                </p>
              ) : null
            ) : docFullySigned && !docRejected ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#16a34a",
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Este documento ya fue firmado por todos los firmantes.
              </p>
            ) : alreadySignedByThisSigner && !docRejected ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#16a34a",
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Ya has firmado este documento.
              </p>
            ) : null}

            {canActOnDocument && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <button
                  className="btn-main btn-primary"
                  style={{ width: "100%" }}
                  onClick={handleConfirm}
                >
                  {isVisado ? "VISAR DOCUMENTO" : "FIRMAR DOCUMENTO"}
                </button>

                {!isVisado && (
                  <button
                    type="button"
                    className="btn-main"
                    style={{
                      width: "100%",
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                    }}
                    onClick={() => {
                      setShowReject(true);
                      setRejectError("");
                    }}
                  >
                    Rechazar documento
                  </button>
                )}
              </div>
            )}

            {showReject && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#7f1d1d",
                  fontSize: "0.9rem",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 8,
                    fontSize: "1rem",
                    color: "#b91c1c",
                  }}
                >
                  Rechazar documento
                </h2>
                <p style={{ marginBottom: 8 }}>
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
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #fecaca",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    marginBottom: 8,
                  }}
                  placeholder="Escribe aquí el motivo de rechazo…"
                />

                {rejectError && (
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: "0.8rem",
                      color: "#b91c1c",
                    }}
                  >
                    {rejectError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    className="btn-main"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#ffffff",
                      color: "#374151",
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
                      padding: "8px 14px",
                      borderRadius: 8,
                      backgroundColor: "#b91c1c",
                      color: "#ffffff",
                      border: "none",
                    }}
                    onClick={handleReject}
                    disabled={rejecting}
                  >
                    {rejecting ? "Enviando rechazo..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
