// src/components/DetailActions.jsx
import React, { useCallback } from "react";
import { API_BASE_URL } from "../constants";
import { useToast } from "../hooks/useToast";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  const base = API_URL.replace(/\/+$/, "");
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

    const motivo = window.prompt("Indique el motivo de rechazo:");
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

    const okConfirm = window.confirm(
      "Declaro que he revisado íntegramente el documento, que tomo conocimiento de su contenido y que emito mi visado en conformidad, para los efectos que correspondan, en el marco de la Ley N° 19.799 sobre documentos electrónicos y firma electrónica. Entiendo que este visado quedará registrado electrónicamente junto con la trazabilidad del proceso."
    );
    if (!okConfirm) return;

    const ok = await manejarAccionDocumento(selectedDoc.id, "visar");
    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  const handleFirmar = useCallback(async () => {
    if (!selectedDoc?.id) return;

    const okConfirm = window.confirm(
      "Declaro que he leído íntegramente el documento, que estoy de acuerdo con su contenido y que autorizo su suscripción mediante firma electrónica simple, de conformidad con la Ley N° 19.799 sobre documentos y firma electrónica, otorgándole la misma validez y eficacia jurídica que a un documento firmado de forma manuscrita en soporte papel."
    );
    if (!okConfirm) return;

    const ok = await manejarAccionDocumento(selectedDoc.id, "firmar");
    if (ok) {
      handleVolver();
    }
  }, [selectedDoc?.id, manejarAccionDocumento, handleVolver]);

  const handleCancelarAdmin = useCallback(async () => {
    if (!selectedDoc?.id) return;

    const okConfirm = window.confirm(
      "¿Desea cancelar este trámite? Esta acción no se puede deshacer."
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
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        borderTop: "1px solid #e5e7eb",
        paddingTop: 16,
      }}
    >
      <button
        type="button"
        className="btn-main"
        style={{
          background: "#e5e7eb",
          color: "#374151",
        }}
        onClick={handleVolver}
      >
        Volver sin firmar
      </button>

      <button
        type="button"
        className="btn-main"
        style={{
          background: "#16a34a",
          color: "white",
        }}
        onClick={handleDownload}
      >
        Descargar PDF
      </button>

      {!isAdmin && puedeRechazar && (
        <button
          type="button"
          className="btn-main"
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
          }}
          onClick={handleRechazar}
        >
          Rechazar
        </button>
      )}

      {!isAdmin && puedeVisar && (
        <button
          type="button"
          className="btn-main"
          style={{
            background: "#fbbf24",
            color: "#78350f",
          }}
          onClick={handleVisar}
        >
          Visar documento
        </button>
      )}

      {!isAdmin && puedeFirmar && (
        <button
          type="button"
          className="btn-main btn-primary"
          onClick={handleFirmar}
        >
          Firmar documento
        </button>
      )}

      {isAdmin && (
        <button
          type="button"
          className="btn-main"
          style={{
            background: "#ef4444",
            color: "white",
          }}
          onClick={handleCancelarAdmin}
        >
          Cancelar trámite
        </button>
      )}
    </div>
  );
}