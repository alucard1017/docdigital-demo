// src/components/DetailActions.jsx
import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  XCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import "../styles/detailActions.css";

export function DetailActions({
  puedeFirmar,
  puedeVisar,
  puedeRechazar,
  selectedDoc,
  setView,
  setSelectedDoc,
  manejarAccionDocumento,
  canAdminDocumentActions,
}) {
  const { addToast } = useToast();

  const [loadingAction, setLoadingAction] = useState(null);

  const docId = selectedDoc?.id ?? null;

  const isBusy = useMemo(() => loadingAction !== null, [loadingAction]);

  const handleBack = () => {
    if (typeof setView === "function") setView("list");
    if (typeof setSelectedDoc === "function") setSelectedDoc(null);
  };

  const runAction = async (action, extraData = {}) => {
    if (!docId || isBusy) return;

    try {
      setLoadingAction(action);

      const ok = await manejarAccionDocumento(docId, action, extraData);

      if (!ok) return;

      if (action === "firmar") {
        addToast({
          type: "success",
          title: "Documento firmado",
          message: "La firma del documento se registró correctamente.",
        });
      }

      if (action === "visar") {
        addToast({
          type: "success",
          title: "Documento visado",
          message: "La aprobación del documento se registró correctamente.",
        });
      }

      if (action === "rechazar") {
        addToast({
          type: "success",
          title: "Documento rechazado",
          message: "El rechazo del documento se registró correctamente.",
        });
      }
    } catch (error) {
      console.error(`Error ejecutando acción ${action}:`, error);

      addToast({
        type: "error",
        title: "No se pudo completar la acción",
        message: "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("Indica el motivo del rechazo:");

    if (reason === null) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      addToast({
        type: "warning",
        title: "Motivo requerido",
        message: "Debes indicar un motivo para rechazar el documento.",
      });
      return;
    }

    await runAction("rechazar", { motivo: trimmedReason });
  };

  const primaryActions = [
    {
      key: "firmar",
      visible: puedeFirmar,
      label: loadingAction === "firmar" ? "Firmando..." : "Firmar documento",
      icon: loadingAction === "firmar" ? Loader2 : CheckCircle2,
      className: "detail-actions__btn detail-actions__btn--sign",
      onClick: () => runAction("firmar"),
      disabled: isBusy,
    },
    {
      key: "visar",
      visible: puedeVisar,
      label: loadingAction === "visar" ? "Visando..." : "Aprobar / visar",
      icon: loadingAction === "visar" ? Loader2 : ShieldCheck,
      className: "detail-actions__btn detail-actions__btn--approve",
      onClick: () => runAction("visar"),
      disabled: isBusy,
    },
    {
      key: "rechazar",
      visible: puedeRechazar,
      label: loadingAction === "rechazar" ? "Rechazando..." : "Rechazar",
      icon: loadingAction === "rechazar" ? Loader2 : XCircle,
      className: "detail-actions__btn detail-actions__btn--reject",
      onClick: handleReject,
      disabled: isBusy,
    },
  ];

  return (
    <section className="detail-actions-card">
      <div className="detail-actions-card__header">
        <div>
          <h3 className="detail-actions-card__title">Acciones del documento</h3>
          <p className="detail-actions-card__subtitle">
            Ejecuta la siguiente acción disponible para este flujo documental.
          </p>
        </div>

        {canAdminDocumentActions ? (
          <span className="detail-actions-card__badge">Modo auditoría habilitado</span>
        ) : null}
      </div>

      <div className="detail-actions-card__body">
        <div className="detail-actions-card__group">
          {primaryActions.filter((action) => action.visible).length === 0 ? (
            <div className="detail-actions-card__empty">
              No hay acciones disponibles para este documento en tu rol actual.
            </div>
          ) : (
            primaryActions
              .filter((action) => action.visible)
              .map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.key}
                    type="button"
                    className={action.className}
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    <Icon
                      size={16}
                      className={loadingAction === action.key ? "is-spinning" : ""}
                    />
                    <span>{action.label}</span>
                  </button>
                );
              })
          )}
        </div>

        <div className="detail-actions-card__secondary">
          <button
            type="button"
            className="detail-actions__btn detail-actions__btn--ghost"
            onClick={handleBack}
            disabled={isBusy}
          >
            <ArrowLeft size={16} />
            <span>Volver a la bandeja</span>
          </button>
        </div>
      </div>
    </section>
  );
}