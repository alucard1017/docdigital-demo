import React, { useCallback, useMemo } from "react";
import { API_BASE_URL } from "../constants";
import { useToast } from "../hooks/useToast";

const API_URL = API_BASE_URL || "";

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
  canAdminDocumentActions = false,
}) {
  const { addToast } = useToast();

  const documentId = selectedDoc?.id ?? null;

  const canShowReject = useMemo(
    () => !canAdminDocumentActions && puedeRechazar,
    [canAdminDocumentActions, puedeRechazar]
  );
  const canShowVisar = useMemo(
    () => !canAdminDocumentActions && puedeVisar,
    [canAdminDocumentActions, puedeVisar]
  );
  const canShowFirmar = useMemo(
    () => !canAdminDocumentActions && puedeFirmar,
    [canAdminDocumentActions, puedeFirmar]
  );
  const canShowAdminCancel = useMemo(
    () => Boolean(canAdminDocumentActions),
    [canAdminDocumentActions]
  );

  const handleVolver = useCallback(() => {
    if (typeof setView === "function") {
      setView("list");
    }

    if (typeof setSelectedDoc === "function") {
      setSelectedDoc(null);
    }
  }, [setView, setSelectedDoc]);

  const handleSuccessAndClose = useCallback(
    ({ title, message }) => {
      addToast({
        type: "success",
        title,
        message,
      });
      handleVolver();
    },
    [addToast, handleVolver]
  );

  const runDocumentAction = useCallback(
    async (action, payload, successToast) => {
      if (!documentId) return;

      const ok = await manejarAccionDocumento(documentId, action, payload);

      if (ok && successToast) {
        handleSuccessAndClose(successToast);
      }
    },
    [documentId, manejarAccionDocumento, handleSuccessAndClose]
  );

  const handleDownload = useCallback(() => {
    if (!documentId) return;

    const url = apiUrl(`/documents/${documentId}/download`);
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
  }, [documentId, addToast]);

  const handleRechazar = useCallback(async () => {
    if (!documentId) return;

    const motivo = window.prompt("Indica el motivo de rechazo:");
    if (!motivo || !motivo.trim()) return;

    await runDocumentAction(
      "rechazar",
      { motivo: motivo.trim() },
      {
        title: "Documento rechazado",
        message: "El documento fue rechazado correctamente.",
      }
    );
  }, [documentId, runDocumentAction]);

  const handleVisar = useCallback(async () => {
    if (!documentId) return;

    await runDocumentAction("visar", undefined, {
      title: "Documento visado",
      message: "El documento fue visado correctamente.",
    });
  }, [documentId, runDocumentAction]);

  const handleFirmar = useCallback(async () => {
    if (!documentId) return;

    await runDocumentAction("firmar", undefined, {
      title: "Documento firmado",
      message: "El documento fue firmado correctamente.",
    });
  }, [documentId, runDocumentAction]);

  const handleCancelarAdmin = useCallback(async () => {
    if (!documentId) return;

    const okConfirm = window.confirm(
      "¿Deseas cancelar este trámite? Esta acción marcará el flujo como rechazado y no se puede deshacer."
    );

    if (!okConfirm) return;

    await runDocumentAction(
      "rechazar",
      { motivo: "Cancelado por administrador" },
      {
        title: "Trámite cancelado",
        message: "El trámite fue cancelado por un administrador.",
      }
    );
  }, [documentId, runDocumentAction]);

  if (!selectedDoc || !documentId) return null;

  return (
    <div className="detail-actions-bar">
      <button
        type="button"
        className="btn-main detail-actions-btn detail-actions-btn--secondary"
        onClick={handleVolver}
      >
        Volver a la bandeja
      </button>

      <button
        type="button"
        className="btn-main detail-actions-btn detail-actions-btn--download"
        onClick={handleDownload}
      >
        Descargar PDF
      </button>

      {canShowReject ? (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--reject"
          onClick={handleRechazar}
        >
          Rechazar
        </button>
      ) : null}

      {canShowVisar ? (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--visar"
          onClick={handleVisar}
        >
          Visar documento
        </button>
      ) : null}

      {canShowFirmar ? (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--primary"
          onClick={handleFirmar}
        >
          Firmar documento
        </button>
      ) : null}

      {canShowAdminCancel ? (
        <button
          type="button"
          className="btn-main detail-actions-btn detail-actions-btn--admin-cancel"
          onClick={handleCancelarAdmin}
        >
          Cancelar trámite
        </button>
      ) : null}
    </div>
  );
}