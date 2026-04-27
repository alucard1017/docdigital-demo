// src/components/DocumentRow.jsx
import React, { useCallback, useMemo } from "react";
import { Eye, Download, FileText, AlertTriangle } from "lucide-react";
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

function formatCreatedAt(createdAt) {
  if (!createdAt) {
    return { date: "-", time: "" };
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "-", time: "" };
  }

  return {
    date: parsed.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

const STATUS_META = {
  PENDIENTE: {
    label: "Pendiente",
    tone: "warning",
  },
  PENDIENTE_FIRMA: {
    label: "Pendiente firma",
    tone: "warning",
  },
  PENDIENTE_VISADO: {
    label: "Pendiente visado",
    tone: "warning",
  },
  VISADO: {
    label: "Visado",
    tone: "teal",
  },
  FIRMADO: {
    label: "Firmado",
    tone: "success",
  },
  RECHAZADO: {
    label: "Rechazado",
    tone: "danger",
  },
  BORRADOR: {
    label: "Borrador",
    tone: "neutral",
  },
};

export function DocumentRow({ doc, onOpenDetail }) {
  const { addToast } = useToast();

  const tipoLabel = useMemo(() => {
    return (
      getPrimaryProcedureLabel(doc) ||
      getProcedureLabel(doc) ||
      "Documento"
    );
  }, [doc]);

  const numeroContrato = useMemo(() => getContractNumber(doc), [doc]);

  const titleDocumento = useMemo(() => {
    return pickFirstNonEmpty(doc?.title, doc?.titulo, doc?.name, "Sin título");
  }, [doc]);

  const createdAt = useMemo(() => formatCreatedAt(doc?.created_at), [doc?.created_at]);

  const statusMeta = useMemo(() => {
    return (
      STATUS_META[doc?.status] || {
        label: doc?.status || "Sin estado",
        tone: "neutral",
      }
    );
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

  const participantePrincipal = displayFirmante || displayEmpresa || "Pendiente de asignar";
  const participanteSecundario =
    displayFirmante && displayEmpresa ? displayEmpresa : "";

  const handleOpenDetail = useCallback(
    (event) => {
      if (event) event.stopPropagation();
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

    const response = await api.get(`/docs/${doc.id}/pdf`);
    const data = response?.data;

    if (!data?.url) {
      throw new Error("No se pudo obtener la URL del PDF");
    }

    return data.url;
  }, [doc?.id]);

  const handleVerPdf = useCallback(
    async (event) => {
      event.stopPropagation();

      try {
        const url = await fetchPdfUrl();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Error abriendo PDF:", error);

        addToast({
          type: "error",
          title: "No se pudo abrir el PDF",
          message: getErrorMessage(error, "No se pudo abrir el PDF"),
        });
      }
    },
    [fetchPdfUrl, addToast]
  );

  const handleDescargarPdf = useCallback(
    async (event) => {
      event.stopPropagation();

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
      } catch (error) {
        console.error("Error descargando PDF:", error);

        addToast({
          type: "error",
          title: "No se pudo descargar el PDF",
          message: getErrorMessage(error, "No se pudo descargar el PDF"),
        });
      }
    },
    [fetchPdfUrl, titleDocumento, addToast]
  );

  const handleVerRechazo = useCallback(
    (event) => {
      event.stopPropagation();

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
    <tr
      className="doc-row"
      onClick={handleOpenDetail}
      aria-label={`Abrir detalle de ${titleDocumento}`}
    >
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
            <span className="doc-date-primary">{createdAt.date}</span>
            <span className="doc-date-separator">•</span>
            <span className="doc-date-secondary">{createdAt.time}</span>
          </div>

          <div className="doc-title-sub-hint">Fecha creación</div>
        </div>
      </td>

      <td className="doc-cell-type">
        <span className="doc-chip-tipo" title={tipoLabel}>
          <FileText size={14} aria-hidden="true" />
          <span>{tipoLabel}</span>
        </span>
      </td>

      <td className="doc-cell-status">
        <div className="doc-status-wrap">
          <span
            className={`doc-status-pill doc-status-pill--${statusMeta.tone}`}
            title={statusMeta.label}
            onClick={(event) => event.stopPropagation()}
          >
            {statusMeta.label}
          </span>
        </div>
      </td>

      <td className="doc-cell-signer">
        <div className="doc-signer-main">{participantePrincipal}</div>
        {participanteSecundario ? (
          <div className="doc-signer-sub">{participanteSecundario}</div>
        ) : null}
      </td>

      <td className="doc-cell-actions" onClick={(event) => event.stopPropagation()}>
        <div className="doc-actions">
          <button
            type="button"
            className="btn-main btn-primary btn-xs"
            onClick={handleVerPdf}
            title="Ver PDF"
            aria-label={`Ver PDF de ${titleDocumento}`}
          >
            <Eye size={14} />
            <span>PDF</span>
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
            <Download size={14} />
            <span>Descarga</span>
          </button>

          {doc?.status === DOC_STATUS.RECHAZADO && doc?.reject_reason ? (
            <button
              type="button"
              className="btn-main btn-secondary-danger btn-xs"
              onClick={handleVerRechazo}
              title="Ver motivo de rechazo"
              aria-label={`Ver motivo de rechazo de ${titleDocumento}`}
            >
              <AlertTriangle size={14} />
              <span>Rechazo</span>
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}