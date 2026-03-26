// src/pages/DocumentDetailPage.js
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useDocumentTimeline } from "../hooks/useDocumentTimeline";
import { Timeline } from "../components/Timeline";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";
import api from "../api/client";

export function DocumentDetailPage() {
  const { id } = useParams();
  const documentId = id ? Number(id) : null;

  const { data, loading, error, reload } = useDocumentTimeline(documentId);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [signing, setSigning] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!documentId || Number.isNaN(documentId)) {
    return <div style={{ padding: 20 }}>ID de documento inválido</div>;
  }

  const document = data?.document || null;

  const handleViewPdf = async () => {
    if (!documentId) return;
    try {
      // Usa el endpoint interno de descarga (prioriza pdf_final_url)
      const res = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error abriendo PDF interno:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo abrir el PDF";
      alert("❌ " + msg);
    }
  };

  const handleSign = async () => {
    if (!documentId) return;

    if (!acceptedLegal) {
      alert("Debes aceptar el aviso legal antes de firmar.");
      return;
    }

    try {
      setSigning(true);
      setActionError("");

      await api.post(`/documents/${documentId}/firmar`);

      alert("✅ Documento firmado correctamente.");
      setAcceptedLegal(false);
      await reload();
    } catch (err) {
      console.error("Error firmando documento:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo firmar el documento";
      setActionError(msg);
      alert("❌ " + msg);
    } finally {
      setSigning(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 20 }}>
        <Timeline timeline={null} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "#ef4444", marginBottom: 8 }}>{error}</p>
        <button onClick={reload}>Reintentar</button>
      </div>
    );
  }

  if (!data || !document) {
    return null;
  }

  const isSigned = document.status === "FIRMADO";
  const isRejected = document.status === "RECHAZADO";

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>{document.title}</h2>
      <p style={{ marginBottom: 16, color: "#6b7280", fontSize: 14 }}>
        Estado actual: <strong>{document.status}</strong>
      </p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <button type="button" onClick={handleViewPdf} className="btn-main">
          Ver PDF
        </button>

        {!isSigned && !isRejected && (
          <button
            type="button"
            onClick={handleSign}
            className="btn-main btn-primary"
            disabled={!acceptedLegal || signing}
          >
            {signing ? "Firmando..." : "Firmar documento"}
          </button>
        )}
      </div>

      {!isSigned && !isRejected && (
        <ElectronicSignatureNotice
          checked={acceptedLegal}
          onChange={setAcceptedLegal}
        />
      )}

      {actionError && (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {actionError}
        </p>
      )}

      <h3 style={{ marginTop: 24, marginBottom: 8 }}>Historial</h3>
      <Timeline timeline={data.timeline} />
    </div>
  );
}