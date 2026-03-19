// src/views/PublicSignView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  return `${API_URL}${path}`;
}

const STATUS_LABELS = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  EN_FIRMA: "En firma",
  FIRMADO: "Firmado",
  RECHAZADO: "Rechazado",
  EXPIRADO: "Expirado",
};

export function PublicSignView({ token }) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);          // incluye info de firmante actual
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  // Leer ?mode=visado desde la URL (permite forzar modo visador)
  const [mode, setMode] = useState(null); // "visado" o null
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeFromUrl = params.get("mode");
    setMode(modeFromUrl || null);
  }, []);

  const isVisado = mode === "visado" || doc?.currentSigner?.role === "VISADOR";

  const isDocumentSigned = useMemo(
    () => doc?.document?.status === "FIRMADO",
    [doc]
  );

  const isCurrentSignerSigned = useMemo(
    () =>
      doc?.currentSigner?.status === "FIRMADO" ||
      doc?.currentSigner?.status === "RECHAZADO",
    [doc]
  );

  const isActionDisabled = isDocumentSigned || isCurrentSignerSigned;

  /* ================================
     CARGA INICIAL DEL DOCUMENTO
     ================================ */

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(apiUrl(`/public/docs/${token}`));
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.message || data.error || "No se pudo cargar el documento"
          );
        }

        // Estructura esperada:
        // {
        //   document: { id, title, status, company_rut, company_name, destinatario_nombre, ... },
        //   currentSigner: { id, name, email, role, status },
        //   pdfUrl: "https://..."
        // }
        setDoc({
          document: data.document,
          currentSigner: data.currentSigner,
        });
        setPdfUrl(data.pdfUrl || "");
      } catch (err) {
        console.error("❌ Error cargando documento público:", err);
        setError(
          err.message || "Error inesperado al cargar el documento para firma."
        );
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDoc();
    }
  }, [token]);

  /* ================================
     MANEJO DE ACCIONES
     ================================ */

  const handlePrimaryClick = () => {
    if (isActionDisabled) return;
    setShowLegal(true);
  };

  const handleConfirm = async () => {
    if (!accepted) {
      alert("Debes aceptar la declaración para continuar.");
      return;
    }

    setSigning(true);
    setError("");

    try {
      const actionPath = isVisado ? "visar" : "firmar";

      const res = await fetch(apiUrl(`/public/docs/${token}/${actionPath}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            (isVisado
              ? "No se pudo registrar el visado."
              : "No se pudo firmar el documento.")
        );
      }

      // Notificación básica
      alert(
        isVisado
          ? "Documento visado correctamente."
          : "Documento firmado correctamente."
      );

      // Actualizar solo el firmante actual y, si viene desde backend, el estado del documento
      setDoc((prev) => {
        if (!prev) return prev;

        const updatedSigner = {
          ...prev.currentSigner,
          status: "FIRMADO",
        };

        const updatedDocument = {
          ...prev.document,
          status: data.documentStatus || prev.document.status, // backend puede devolver nuevo estado
        };

        return {
          document: updatedDocument,
          currentSigner: updatedSigner,
        };
      });

      setShowLegal(false);
      setAccepted(false);
    } catch (err) {
      console.error("❌ Error confirmando firma:", err);
      setError(
        err.message ||
          (isVisado
            ? "Error inesperado al registrar el visado."
            : "Error inesperado al registrar la firma.")
      );
      alert(
        err.message ||
          (isVisado
            ? "Error inesperado al registrar el visado."
            : "Error inesperado al registrar la firma.")
      );
    } finally {
      setSigning(false);
    }
  };

  /* ================================
     RENDER
     ================================ */

  if (loading) {
    return <p style={{ padding: 24 }}>Cargando documento...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>
          No se pudo cargar el documento
        </h1>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  if (!doc?.document) {
    return (
      <p style={{ padding: 24 }}>
        Documento no encontrado o el enlace ya no es válido.
      </p>
    );
  }

  const { document, currentSigner } = doc;
  const statusLabel = STATUS_LABELS[document.status] || document.status;

  const primaryButtonLabel = (() => {
    if (isDocumentSigned) return "Documento ya completado";
    if (isCurrentSignerSigned) return "Tu acción ya fue registrada";
    if (isVisado) return "VISAR DOCUMENTO";
    return "FIRMAR DOCUMENTO";
  })();

  const headerTitle = isVisado ? "Visado de documento" : "Firma de documento";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Encabezado */}
      <header>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>{headerTitle}</h1>

        <p style={{ marginBottom: 4 }}>
          Documento: <strong>{document.title}</strong>
        </p>
        {document.company_name && (
          <p style={{ marginBottom: 4 }}>
            Empresa:{" "}
            <strong>
              {document.company_name}
              {document.company_rut ? ` (${document.company_rut})` : ""}
            </strong>
          </p>
        )}
        {document.destinatario_nombre && (
          <p style={{ marginBottom: 4 }}>
            Destinatario: <strong>{document.destinatario_nombre}</strong>
          </p>
        )}

        {currentSigner && (
          <p style={{ marginBottom: 4 }}>
            Usted está actuando como{" "}
            <strong>
              {isVisado ? "VISADOR" : "FIRMANTE"}
              {currentSigner.name ? `: ${currentSigner.name}` : ""}
            </strong>
          </p>
        )}

        <p style={{ marginBottom: 0 }}>
          Estado actual del documento: <strong>{statusLabel}</strong>
        </p>
      </header>

      {/* Visor PDF */}
      {pdfUrl ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            height: "70vh",
            backgroundColor: "#000",
          }}
        >
          <iframe
            title="Documento PDF"
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      ) : (
        <p>No se pudo cargar el PDF adjunto.</p>
      )}

      {/* Panel de acción principal */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
          background: "#f9fafb",
        }}
      >
        <button
          type="button"
          className="btn-main btn-primary"
          style={{
            width: "100%",
            opacity: isActionDisabled ? 0.6 : 1,
            cursor: isActionDisabled ? "not-allowed" : "pointer",
          }}
          onClick={handlePrimaryClick}
          disabled={isActionDisabled}
          aria-label={
            isVisado
              ? isActionDisabled
                ? "Documento ya visado/finalizado"
                : "Visar documento"
              : isActionDisabled
              ? "Documento ya firmado/finalizado"
              : "Firmar documento"
          }
        >
          {primaryButtonLabel}
        </button>

        {/* Panel legal */}
        {showLegal && !isActionDisabled && (
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

            <button
              type="button"
              className="btn-main btn-primary"
              style={{ marginTop: 12, width: "100%" }}
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
        )}

        {/* Mensaje de estado del firmante actual */}
        {isCurrentSignerSigned && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            Ya registraste tu respuesta para este documento. Si crees que esto
            es un error, contacta a quien te envió el enlace.
          </p>
        )}
      </section>
    </div>
  );
}
