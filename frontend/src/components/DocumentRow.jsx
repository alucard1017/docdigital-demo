// src/components/DocumentRow.jsx
import React, { useCallback, useMemo } from "react";
import { DOC_STATUS } from "../constants";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "./detailView.helpers";
import {
  getProcedureLabel,
  getPrimaryProcedureLabel,
} from "../utils/documentLabels";

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function getContractNumber(doc) {
  return (
    doc?.numero_contrato_interno ||
    doc?.numero_contrato ||
    doc?.contract_number ||
    doc?.n_contrato ||
    doc?.numerocontratointerno ||
    "Sin número"
  );
}

const STATUS_LABELS = {
  PENDIENTE: "Pendiente",
  PENDIENTE_FIRMA: "Pendiente firma",
  PENDIENTE_VISADO: "Pendiente visado",
  VISADO: "Visado",
  FIRMADO: "Firmado",
  RECHAZADO: "Rechazado",
  BORRADOR: "Borrador",
};

const STATUS_COLORS = {
  PENDIENTE: "#f59e0b",
  PENDIENTE_FIRMA: "#f59e0b",
  PENDIENTE_VISADO: "#f59e0b",
  VISADO: "#0f766e",
  FIRMADO: "#16a34a",
  RECHAZADO: "#b91c1c",
  BORRADOR: "#6b7280",
};

export function DocumentRow({ doc, onOpenDetail }) {
  const { addToast } = useToast();

  const tipoLabel = useMemo(() => {
    return getPrimaryProcedureLabel(doc) || getProcedureLabel(doc) || "Documento";
  }, [doc]);

  const numeroContrato = useMemo(() => getContractNumber(doc), [doc]);

  const titleDocumento = useMemo(() => {
    return pickFirstNonEmpty(doc?.title, doc?.titulo, doc?.name, "Sin título");
  }, [doc]);

  const { fechaLinea1, fechaLinea2 } = useMemo(() => {
    if (!doc?.created_at) {
      return { fechaLinea1: "-", fechaLinea2: "" };
    }

    const date = new Date(doc.created_at);
    if (Number.isNaN(date.getTime())) {
      return { fechaLinea1: "-", fechaLinea2: "" };
    }

    return {
      fechaLinea1: date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      fechaLinea2: date.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [doc?.created_at]);

  const estadoLabel = useMemo(() => {
    return STATUS_LABELS[doc?.status] || doc?.status || "Sin estado";
  }, [doc?.status]);

  const estadoColor = useMemo(() => {
    return STATUS_COLORS[doc?.status] || "#6b7280";
  }, [doc?.status]);

  const displayFirmante = useMemo(
    () =>
      pickFirstNonEmpty(
        doc?.firmante_nombre,
        doc?.firmanteName,
        doc?.participant_nombre,
        doc?.participant_name,
        doc?.signer_name,
        doc?.signer
      ),
    [doc]
  );

  const displayEmpresa = useMemo(
    () =>
      pickFirstNonEmpty(
        doc?.destinatario_nombre,
        doc?.empresa_nombre,
        doc?.company_name,
        doc?.razon_social
      ),
    [doc]
  );

  const displayParticipantePrincipal = displayFirmante || displayEmpresa;
  const displayParticipanteSecundario =
    displayFirmante && displayEmpresa ? displayEmpresa : "";

  const participanteFallback = "Pendiente de asignar";

  const handleOpenDetail = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (typeof onOpenDetail === "function") {
        onOpenDetail(doc);
      }
    },
    [doc, onOpenDetail]
  );

  const fetchPdfUrl = useCallback(async () => {
    if (!doc?.id) {
      throw new Error("Documento inválido");
    }

    const res = await api.get(`/docs/${doc.id}/pdf`);
    const data = res.data;

    if (!data?.url) {
      throw new Error("No se pudo obtener la URL del PDF");
    }

    return data.url;
  }, [doc?.id]);

  const handleVerPdf = useCallback(
    async (e) => {
      e.stopPropagation();

      try {
        const url = await fetchPdfUrl();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("Error abriendo PDF:", err);

        addToast({
          type: "error",
          title: "No se pudo abrir el PDF",
          message: getErrorMessage(err, "No se pudo abrir el PDF"),
        });
      }
    },
    [fetchPdfUrl, addToast]
  );

  const handleDescargarPdf = useCallback(
    async (e) => {
      e.stopPropagation();

      try {
        const url = await fetchPdfUrl();

        const link = document.createElement("a");
        link.href = url;
        link.download = `${titleDocumento}.pdf`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addToast({
          type: "success",
          title: "Descarga iniciada",
          message: `Se inició la descarga de "${titleDocumento}".`,
        });
      } catch (err) {
        console.error("Error descargando PDF:", err);

        addToast({
          type: "error",
          title: "No se pudo descargar el PDF",
          message: getErrorMessage(err, "No se pudo descargar el PDF"),
        });
      }
    },
    [fetchPdfUrl, titleDocumento, addToast]
  );

  const handleVerRechazo = useCallback(
    (e) => {
      e.stopPropagation();

      if (!doc?.reject_reason) {
        addToast({
          type: "info",
          title: "Sin motivo registrado",
          message: "Este documento no tiene motivo de rechazo.",
        });
        return;
      }

      addToast({
        type: "warning",
        title: "Motivo de rechazo",
        message: doc.reject_reason,
      });
    },
    [doc?.reject_reason, addToast]
  );

  return (
    <tr className="doc-row" onClick={handleOpenDetail}>
      <td className="doc-cell-title doc-cell-title-unified">
        <div className="doc-title-stack">
          <div className="doc-title-contract-row">
            <span
              className={`doc-id-pill ${
                numeroContrato === "Sin número" ? "is-empty" : ""
              }`}
              title={numeroContrato}
            >
              {numeroContrato}
            </span>
          </div>

          <div className="doc-title-main" title={titleDocumento}>
            {titleDocumento}
          </div>

          <div className="doc-title-meta">
            <span className="doc-date-primary">{fechaLinea1}</span>
            <span className="doc-date-separator">•</span>
            <span className="doc-date-secondary">{fechaLinea2}</span>
          </div>

          <div className="doc-title-sub-hint">Fecha creación</div>
        </div>
      </td>

      <td className="doc-cell-type">
        <span className="doc-chip-tipo" title={tipoLabel}>
          {tipoLabel}
        </span>
      </td>

      <td className="doc-cell-status">
        <div className="doc-status-wrap">
          <span
            className="doc-status-pill"
            style={{ backgroundColor: estadoColor }}
            onClick={(e) => e.stopPropagation()}
            title={estadoLabel}
          >
            {estadoLabel}
          </span>
        </div>
      </td>

      <td className="doc-cell-signer">
        <div className="doc-signer-main">
          {displayParticipantePrincipal || participanteFallback}
        </div>
        {displayParticipanteSecundario ? (
          <div className="doc-signer-sub">{displayParticipanteSecundario}</div>
        ) : null}
      </td>

      <td className="doc-cell-actions" onClick={(e) => e.stopPropagation()}>
        <div className="doc-actions">
          <button
            type="button"
            className="btn-main btn-primary btn-xs"
            onClick={handleVerPdf}
            title="Ver PDF"
            aria-label={`Ver PDF de ${titleDocumento}`}
          >
            PDF
          </button>

          <button
            type="button"
            className="btn-main btn-secondary btn-xs"
            onClick={handleOpenDetail}
            title="Abrir detalle"
            aria-label={`Abrir detalle de ${titleDocumento}`}
          >
            Abrir
          </button>

          <button
            type="button"
            className="btn-main btn-ghost btn-xs"
            onClick={handleDescargarPdf}
            title="Descargar PDF"
            aria-label={`Descargar PDF de ${titleDocumento}`}
          >
            Descarga
          </button>

          {doc?.status === DOC_STATUS.RECHAZADO && doc?.reject_reason && (
            <button
              type="button"
              className="btn-main btn-secondary-danger btn-xs"
              onClick={handleVerRechazo}
              title="Ver motivo de rechazo"
              aria-label={`Ver motivo de rechazo de ${titleDocumento}`}
            >
              Rechazo
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}