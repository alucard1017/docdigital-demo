// src/components/DocumentRow.js
import React from "react";
import { DOC_STATUS } from "../constants";
import api from "../api/client";

function getTramiteLabel(value) {
  if (value === "notaria") return "Notaría";
  if (value === "propio") return "Propio";
  return "Otro";
}

function getDocumentoLabel(value) {
  if (value === "poderes") return "Poderes";
  if (value === "contratos") return "Contratos";
  return "Otro";
}

// Separa el tipo en 2 líneas
function splitTipoTramite(labelTramite, labelDoc) {
  const linea1 = labelTramite || "";
  const linea2 = labelDoc || "";
  return { linea1, linea2 };
}

const STATUS_LABELS = {
  PENDIENTE: "Pendiente",
  PENDIENTE_FIRMA: "Pendiente firma",
  PENDIENTE_VISADO: "Pendiente visado",
  VISADO: "Visado",
  FIRMADO: "Firmado",
  RECHAZADO: "Rechazado",
};

const STATUS_COLORS = {
  PENDIENTE: "#f59e0b",
  PENDIENTE_FIRMA: "#f59e0b",
  PENDIENTE_VISADO: "#f59e0b",
  VISADO: "#0f766e",
  FIRMADO: "#16a34a",
  RECHAZADO: "#b91c1c",
};

export function DocumentRow({ doc, onOpenDetail }) {
  const tipoTramite = doc.tipo_tramite || null;
  const tipoDocumento = doc.tipo_documento || null;

  const labelTramite = getTramiteLabel(tipoTramite);
  const labelDoc = getDocumentoLabel(tipoDocumento);

  const { linea1, linea2 } = splitTipoTramite(labelTramite, labelDoc);

  const chipBgColor =
    tipoTramite === "notaria"
      ? "#eef2ff"
      : tipoDocumento === "poderes"
      ? "#f5f3ff"
      : tipoDocumento === "contratos"
      ? "#fef2f2"
      : "#ecfeff";

  const chipTextColor =
    tipoTramite === "notaria"
      ? "#4f46e5"
      : tipoDocumento === "poderes"
      ? "#7c3aed"
      : tipoDocumento === "contratos"
      ? "#dc2626"
      : "#0f766e";

  // Partimos la fecha en 2–3 líneas para que no se solape
  let fechaLinea1 = "-";
  let fechaLinea2 = "";
  let fechaLinea3 = "";

  if (doc.created_at) {
    const d = new Date(doc.created_at);

    const dia = d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const hora = d.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // línea 1: fecha, línea 2: hora, línea 3: texto libre (opcional)
    fechaLinea1 = dia;
    fechaLinea2 = hora;
    fechaLinea3 = "Fecha creación";
  }

  const estadoLabel = STATUS_LABELS[doc.status] || doc.status || "Sin estado";
  const estadoColor = STATUS_COLORS[doc.status] || "#6b7280";

  const handleVerPdf = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/docs/${doc.id}/pdf`);
      const data = res.data;

      if (!data || !data.url) {
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

  const handleVerRechazo = (e) => {
    e.stopPropagation();
    if (!doc.reject_reason) {
      alert("Este documento no tiene motivo de rechazo.");
      return;
    }
    alert("Motivo de rechazo:\n\n" + doc.reject_reason);
  };

  const handleOpenDetail = () => {
    onOpenDetail(doc);
  };

  return (
    <tr className="doc-row" onClick={handleOpenDetail}>
      {/* N° contrato */}
      <td className="doc-cell-id">
        <span className="doc-id-pill">
          {doc.numero_contrato_interno || `#${doc.id}`}
        </span>
      </td>

      {/* Título + fecha en varias líneas */}
      <td className="doc-cell-title">
        <div className="doc-title-main">{doc.title || "Sin título"}</div>
        <div className="doc-title-sub-multiline">
          <div>{fechaLinea1}</div>
          <div>{fechaLinea2}</div>
          <div className="doc-title-sub-hint">{fechaLinea3}</div>
        </div>
      </td>

      {/* Tipo de trámite / documento */}
      <td>
        <div
          className="doc-chip-tipo"
          style={{
            backgroundColor: chipBgColor,
            color: chipTextColor,
          }}
          title={`${labelTramite} · ${labelDoc}`}
        >
          <span>{linea1}</span>
          <span className="doc-chip-sub">{linea2}</span>
        </div>
      </td>

      {/* Estado */}
      <td className="doc-cell-status">
        <span
          className="doc-status-pill"
          style={{ backgroundColor: estadoColor }}
          onClick={(e) => e.stopPropagation()}
        >
          {estadoLabel}
        </span>
      </td>

      {/* Firmante */}
      <td className="doc-cell-signer">
        <div className="doc-signer-main">
          {doc.firmante_nombre || "No asignado"}
        </div>
        {doc.destinatario_nombre && (
          <div className="doc-signer-sub">{doc.destinatario_nombre}</div>
        )}
      </td>

      {/* Acciones */}
      <td className="doc-cell-actions">
        <div className="doc-actions">
          {doc.status === DOC_STATUS.RECHAZADO && doc.reject_reason && (
            <button
              type="button"
              className="btn-main btn-secondary-danger btn-xs"
              onClick={handleVerRechazo}
            >
              Ver rechazo
            </button>
          )}

          <button
            type="button"
            className="btn-main btn-secondary btn-xs"
            onClick={handleVerPdf}
          >
            Ver PDF
          </button>

          <button
            type="button"
            className="btn-main btn-primary btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail();
            }}
          >
            Abrir documento
          </button>
        </div>
      </td>
    </tr>
  );
}