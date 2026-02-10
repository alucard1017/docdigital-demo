// src/views/PublicSignView.jsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

export function PublicSignView({ token }) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [mode, setMode] = useState(null);           // "visado" o null
  const [showLegal, setShowLegal] = useState(false); // muestra banner y checkbox

  // Leer ?mode=visado desde la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeUrl = params.get("mode");
    setMode(modeUrl || null);
  }, []);

  const isVisado = mode === "visado";

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/docs/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "No se pudo cargar el documento");
        setDoc(data.document);
        setPdfUrl(data.pdfUrl);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchDoc();
  }, [token]);

  // Paso 2: confirmar (cuando ya vio el texto legal y marcó el checkbox)
  const handleConfirm = async () => {
    if (!accepted) {
      alert("Debes aceptar la declaración para continuar.");
      return;
    }
    setSigning(true);
    try {
      const actionPath = isVisado ? "visar" : "firmar";

      const res = await fetch(`${API_URL}/api/public/docs/${token}/${actionPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ||
            (isVisado
              ? "No se pudo registrar el visado"
              : "No se pudo firmar el documento")
        );
      }

      alert(
        isVisado
          ? "Documento visado correctamente."
          : "Documento firmado correctamente."
      );

      setDoc((prev) =>
        prev ? { ...prev, status: isVisado ? "PENDIENTE_FIRMA" : "FIRMADO" } : prev
      );
      setShowLegal(false);
      setAccepted(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSigning(false);
    }
  };

  // Paso 1: botón principal que solo abre el panel legal
  const handlePrimaryClick = () => {
    if (doc?.status === "FIRMADO") return;
    setShowLegal(true);
  };

  if (loading) return <p style={{ padding: 24 }}>Cargando documento...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;
  if (!doc) return <p style={{ padding: 24 }}>Documento no encontrado</p>;

  const isSigned = doc.status === "FIRMADO";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <header>
        <h1>{isVisado ? "Visado de documento" : "Firma de documento"}</h1>
        <p>
          Documento: <strong>{doc.title}</strong>
        </p>
        <p>
          Empresa: <strong>{doc.empresa_rut}</strong>
        </p>
        <p>
          Destinatario: <strong>{doc.destinatario_nombre}</strong>
        </p>
        <p>
          Estado actual: <strong>{doc.status}</strong>
        </p>
      </header>

      {/* Visor PDF público */}
      {pdfUrl ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            height: "70vh",
          }}
        >
          <iframe
            title="Documento PDF"
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      ) : (
        <p>No se pudo cargar el PDF.</p>
      )}

      {/* Botón principal: abrir panel legal */}
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
          style={{ width: "100%", opacity: isSigned ? 0.6 : 1 }}
          onClick={handlePrimaryClick}
          disabled={isSigned}
        >
          {isVisado
            ? isSigned
              ? "Documento ya firmado"
              : "VISAR DOCUMENTO"
            : isSigned
            ? "Documento ya firmado"
            : "FIRMAR DOCUMENTO"}
        </button>

        {/* Panel legal que aparece solo después de hacer clic */}
        {showLegal && !isSigned && (
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
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
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
      </section>
    </div>
  );
}
