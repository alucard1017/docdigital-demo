// src/components/PublicSignView.jsx
import React, { useState } from "react";

function stripTrailingSlashes(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function ensureApiBase(value = "") {
  const clean = stripTrailingSlashes(value);
  if (!clean) return "";
  return clean.endsWith("/api") ? clean : `${clean}/api`;
}

/**
 * Componente sencillo de firma pública (versión legacy)
 * No debe usarse en el portal principal; el flujo completo vive en src/views/PublicSignView.jsx
 */
export function LegacyPublicSignCard({
  publicSignLoading,
  publicSignError,
  publicSignDoc,
  publicSignPdfUrl,
  publicSignToken,
  publicSignMode,
  publicTokenKind,
  API_URL,
  cargarFirmaPublica,
}) {
  const apiBase = ensureApiBase(API_URL);
  const isVisado = publicSignMode === "visado";

  const document = publicSignDoc?.document || null;
  const signer = publicSignDoc?.signer || null;
  const pdfUrl = publicSignPdfUrl || "";

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  const [showLegal, setShowLegal] = useState(false);
  const [accepted, setAccepted] = useState(false);
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

  function buildActionEndpoint(action) {
    if (!apiBase || !publicSignToken) return null;

    const encodedToken = encodeURIComponent(publicSignToken);

    if (action === "visar") {
      return `${apiBase}/public/docs/document/${encodedToken}/visar`;
    }

    if (action === "firmar") {
      return `${apiBase}/public/docs/${encodedToken}/firmar`;
    }

    if (action === "rechazar") {
      return `${apiBase}/public/docs/${encodedToken}/rechazar`;
    }

    return `${apiBase}/public/docs/${encodedToken}/${action}`;
  }

  async function handleConfirm() {
    if (!accepted) {
      alert("Debes aceptar la declaración para continuar.");
      return;
    }

    const action = isVisado ? "visar" : "firmar";
    const endpoint = buildActionEndpoint(action);

    if (!endpoint) {
      alert(getDefaultErrorMessage());
      return;
    }

    try {
      setSigning(true);

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

      alert(
        isVisado
          ? "✅ Visado registrado correctamente."
          : "✅ Firma registrada correctamente."
      );

      setShowLegal(false);
      setAccepted(false);

      if (typeof cargarFirmaPublica === "function") {
        await cargarFirmaPublica(publicSignToken, {
          mode: publicSignMode,
          tokenKind: publicTokenKind || (isVisado ? "document" : "signer"),
        });
      }
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
    const endpoint = buildActionEndpoint("rechazar");

    if (!endpoint) {
      setRejectError(
        "No se pudo determinar el enlace de rechazo. Intenta nuevamente."
      );
      return;
    }

    try {
      setRejectError("");

      const motivo = (rejectReason || "").trim();
      if (!motivo) {
        setRejectError("Debes ingresar un motivo de rechazo.");
        return;
      }

      setRejecting(true);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });

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

      if (typeof cargarFirmaPublica === "function") {
        await cargarFirmaPublica(publicSignToken, {
          mode: publicSignMode,
          tokenKind: publicTokenKind || "signer",
        });
      }

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

  if (showSkeleton) {
    return (
      <div className="login-bg">
        <div className="login-card" style={{ maxWidth: 840 }}>
          <p style={{ padding: 32, textAlign: "center" }}>
            Cargando información del documento…
          </p>
        </div>
      </div>
    );
  }

  if (publicSignError) {
    return (
      <div className="login-bg">
        <div className="login-card" style={{ maxWidth: 840 }}>
          <div
            style={{
              marginTop: 12,
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              No se pudo cargar el documento.
            </div>
            <div>{publicSignError}</div>
            {publicSignToken && typeof cargarFirmaPublica === "function" && (
              <button
                type="button"
                className="btn-main"
                style={{
                  marginTop: 10,
                  padding: "8px 14px",
                  borderRadius: 999,
                  backgroundColor: "#0f172a",
                  color: "#e5e7eb",
                  border: "none",
                }}
                onClick={() =>
                  cargarFirmaPublica(publicSignToken, {
                    mode: publicSignMode,
                    tokenKind: publicTokenKind || "signer",
                  })
                }
                disabled={publicSignLoading}
              >
                Reintentar carga
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="login-bg">
        <div className="login-card" style={{ maxWidth: 840 }}>
          <p style={{ padding: 24 }}>
            Documento no encontrado o el enlace ya no es válido.
          </p>
        </div>
      </div>
    );
  }

  const primaryLabel = isVisado ? "VISAR DOCUMENTO" : "FIRMAR DOCUMENTO";

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 840 }}>
        <h1
          style={{
            textAlign: "center",
            color: isVisado ? "#b45309" : "#1e3a8a",
            marginBottom: 10,
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          {isVisado ? "Visado de documento" : "Firma de documento"}
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            marginBottom: 16,
            fontSize: "0.9rem",
          }}
        >
          Documento: <strong>{document.title}</strong>
        </p>

        {signer && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "#64748b",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Estás actuando como{" "}
            <strong>
              {isVisado ? "visador" : "firmante"}: {signer.name}
            </strong>
          </p>
        )}

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-main btn-primary"
              style={{ textDecoration: "none" }}
            >
              Ver documento en PDF
            </a>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              No se pudo cargar el PDF adjunto.
            </p>
          )}
        </div>

        {canActOnDocument && (
          <button
            className="btn-main btn-primary"
            style={{ width: "100%" }}
            onClick={() => setShowLegal(true)}
            disabled={signing}
          >
            {primaryLabel}
          </button>
        )}

        {showLegal && canActOnDocument && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              backgroundColor: isVisado ? "#fffbeb" : "#eff6ff",
              border: `1px solid ${isVisado ? "#f59e0b" : "#3b82f6"}`,
              color: isVisado ? "#92400e" : "#1e3a8a",
              fontSize: 14,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: "1rem" }}>
              {isVisado
                ? "Declaración de visación del documento"
                : "Confirmación de firma electrónica"}
            </h2>

            <p style={{ whiteSpace: "pre-line", marginBottom: 12 }}>
              {isVisado
                ? `Mediante este acto, el visador declara que ha revisado íntegramente el documento individualizado y que su contenido se ajusta a las normas internas y a la legislación aplicable, para los fines de control y validación administrativa que correspondan.

La presente visación tiene carácter de constancia de revisión y conformidad, y no reemplaza ni equivale a la firma electrónica del representante legal, de acuerdo con lo dispuesto en la Ley N° 19.799 sobre documentos electrónicos y firma electrónica y su normativa complementaria.`
                : `Declaro que he leído íntegramente el documento mostrado arriba, que estoy de acuerdo con su contenido y que autorizo su suscripción mediante firma electrónica, otorgándole la misma validez y efecto jurídico que a mi firma manuscrita, conforme a la Ley N° 19.799 sobre documentos electrónicos y firma electrónica y su normativa complementaria.`}
            </p>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
              }}
            >
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                Acepto la declaración anterior y deseo{" "}
                {isVisado ? "visar el documento" : "firmar el documento"}.
              </span>
            </label>

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="btn-main"
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                }}
                onClick={() => {
                  setShowLegal(false);
                  setAccepted(false);
                }}
                disabled={signing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-main btn-primary"
                style={{ padding: "8px 14px", borderRadius: 999 }}
                onClick={handleConfirm}
                disabled={!accepted || signing}
              >
                {signing
                  ? isVisado
                    ? "Visando..."
                    : "Firmando..."
                  : isVisado
                  ? "Confirmar visado"
                  : "Confirmar firma"}
              </button>
            </div>
          </div>
        )}

        {showReject && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          >
            <h3 style={{ marginBottom: 8, color: "#991b1b" }}>
              Rechazar documento
            </h3>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Escribe el motivo del rechazo"
              rows={4}
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                padding: 10,
                resize: "vertical",
              }}
            />

            {rejectError ? (
              <p style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>
                {rejectError}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="btn-main"
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
                  backgroundColor: "#b91c1c",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "8px 14px",
                }}
                onClick={handleReject}
                disabled={rejecting}
              >
                {rejecting ? "Rechazando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        )}

        {!isVisado && canActOnDocument && !showReject && (
          <button
            type="button"
            className="btn-main"
            style={{
              width: "100%",
              marginTop: 12,
              backgroundColor: "#fff",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
            onClick={() => setShowReject(true)}
          >
            Rechazar documento
          </button>
        )}

        {docRejected && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#b91c1c",
              textAlign: "center",
            }}
          >
            Este documento fue rechazado. No es posible firmarlo ni modificar su
            estado.
          </p>
        )}
      </div>
    </div>
  );
}