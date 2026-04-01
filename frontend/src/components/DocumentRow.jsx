// src/components/DocumentRow.js
import React from "react";
import { DOC_STATUS } from "../constants";
import api from "../api/client";

function getTramiteLabel(value) {
  if (value === "notaria") return "Notaría";
  if (value === "propio") return "Propio";
  return "";
}

function getDocumentoLabel(value) {
  if (value === "poderes") return "Poderes";
  if (value === "contratos") return "Contratos";
  return "";
}

function buildTipoLabel(tipoTramite, tipoDocumento) {
  const tramite = getTramiteLabel(tipoTramite);
  const documento = getDocumentoLabel(tipoDocumento);

  if (tramite && documento) return `${tramite} · ${documento}`;
  if (documento) return documento;
  if (tramite) return tramite;
  return "Sin tipo";
}

function getContractNumber(doc) {
  return (
    doc.numero_contrato_interno ||
    doc.numero_contrato ||
    doc.contract_number ||
    doc.n_contrato ||
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
  const tipoLabel = buildTipoLabel(doc.tipo_tramite, doc.tipo_documento);
  const numeroContrato = getContractNumber(doc);
  const titleDocumento = doc.title || "Sin título";

  let fechaLinea1 = "-";
  let fechaLinea2 = "";

  if (doc.created_at) {
    const d = new Date(doc.created_at);

    fechaLinea1 = d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    fechaLinea2 = d.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const estadoLabel = STATUS_LABELS[doc.status] || doc.status || "Sin estado";
  const estadoColor = STATUS_COLORS[doc.status] || "#6b7280";

  const handleOpenDetail = (e) => {
    if (e) e.stopPropagation();
    if (typeof onOpenDetail === "function") {
      onOpenDetail(doc);
    }
  };

  const handleVerPdf = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/docs/${doc.id}/pdf`);
      const data = res.data;

      if (!data?.url) {
        throw new Error("No se pudo obtener la URL del PDF");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error abriendo PDF:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo abrir el PDF";
      alert("❌ " + msg);
    }
  };

  const handleDescargarPdf = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/docs/${doc.id}/pdf`);
      const data = res.data;

      if (!data?.url) {
        throw new Error("No se pudo obtener la URL del PDF");
      }

      const link = document.createElement("a");
      link.href = data.url;
      link.download = `${titleDocumento}.pdf`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error descargando PDF:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo descargar el PDF";
      alert("❌ " + msg);
    }
  };

  const handleVerRechazo = (e) => {
    e.stopPropagation();
    if (!doc.reject_reason) {
      alert("Este documento no tiene motivo de rechazo.");
      return;
    }
    alert("Motivo de rechazo:\n\n" + doc.reject_reason);
  };

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
          {doc.firmante_nombre || "No asignado"}
        </div>
        <div className="doc-signer-sub">
          {doc.destinatario_nombre || "Sin empresa"}
        </div>
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

          {doc.status === DOC_STATUS.RECHAZADO && doc.reject_reason && (
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