// src/components/DetailActions.jsx
import React, { useCallback } from "react";
import { API_BASE_URL } from "../constants";
import { useToast } from "../hooks/useToast";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  const base = (API_URL || "").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function DetailActions({
  puedeFirmar,
  puedeVisar,
  puedeRechazar,
  selectedDoc,
  setView,
  setSelectedDoc,
  manejarAccionDocumento,
  isAdmin = false,
}) {
  const { addToast } = useToast();

  if (!selectedDoc) return null;

  const handleVolver = useCallback(() => {
    setView("list");
    setSelectedDoc(null);
  }, [setView, setSelectedDoc]);

  const handleDownload = useCallback(() => {
    if (!selectedDoc?.id) return;

    const url = apiUrl(`/docs/${selectedDoc.id}/download`);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: "success",
      title: "Descarga iniciada",
      message: "Se inició la descarga del documento.",
    });
  }, [selectedDoc?.id, addToast]);

  const handleRechazar = useCallback(async () => {
    if (!selectedDoc?.id) return;

    const motivo = window.prompt("Indica el motivo de rechazo:");
    if (!motivo) return;

    const ok = await manejarAccionDocumento(selectedDoc.id, "rechazar", {
      motivo,
    });

    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  const handleVisar = useCallback(async () => {
    if (!selectedDoc?.id) return;

    // El aviso legal ya se valida en DetailView (ElectronicSignatureNotice),
    // aquí solo ejecutamos la acción.
    const ok = await manejarAccionDocumento(selectedDoc.id, "visar");
    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  const handleFirmar = useCallback(async () => {
    if (!selectedDoc?.id) return;

    // Igual que en visado: el aviso legal ya se exige antes.
    const ok = await manejarAccionDocumento(selectedDoc.id, "firmar");
    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  const handleCancelarAdmin = useCallback(async () => {
    if (!selectedDoc?.id) return;

    const okConfirm = window.confirm(
      "¿Deseas cancelar este trámite? Esta acción no se puede deshacer."
    );
    if (!okConfirm) return;

    const ok = await manejarAccionDocumento(selectedDoc.id, "rechazar", {
      motivo: "Cancelado por administrador",
    });

    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  return (
    <div className="detail-actions-bar">
      <button
        type="button"
        className="btn-main detail-actions-btn detail-actions-btn--secondary"
        onClick={handleVolver}
      >
        Volver sin firmar
      </button>

      <button
        type="button"
        className="btn-main detail-actions-btn detail-actions-btn--download"
        onClick={handleDownload}
      >
        Descargar PDF
      </button>

      {!isAdmin && puedeRechazar && (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--reject"
          onClick={handleRechazar}
        >
          Rechazar
        </button>
      )}

      {!isAdmin && puedeVisar && (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--visar"
          onClick={handleVisar}
        >
          Visar documento
        </button>
      )}

      {!isAdmin && puedeFirmar && (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--primary"
          onClick={handleFirmar}
        >
          Firmar documento
        </button>
      )}

      {isAdmin && (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--admin-cancel"
          onClick={handleCancelarAdmin}
        >
          Cancelar trámite
        </button>
      )}
    </div>
  );
}