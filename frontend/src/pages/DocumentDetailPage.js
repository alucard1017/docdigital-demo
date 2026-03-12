// src/pages/DocumentDetailPage.js
import React from "react";
import { useParams } from "react-router-dom";
import { useDocumentTimeline } from "../hooks/useDocumentTimeline";
import { Timeline } from "../components/Timeline";

export function DocumentDetailPage() {
  const { id } = useParams();
  const documentId = id ? Number(id) : null;

  const { data, loading, error, reload } = useDocumentTimeline(documentId);

  if (!documentId || Number.isNaN(documentId)) {
    return <div>ID de documento inválido</div>;
  }

  if (loading && !data) {
    return <Timeline timeline={null} />;
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "#ef4444", marginBottom: 8 }}>{error}</p>
        <button onClick={reload}>Reintentar</button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 16 }}>{data.document.title}</h2>
      <Timeline timeline={data.timeline} />
    </div>
  );
}
