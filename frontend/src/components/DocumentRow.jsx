// src/components/DocumentRow.jsx
import React from "react";
import { DOC_STATUS, API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

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

export function DocumentRow({ doc, onOpenDetail, token }) {
  const tipoTramite = doc.tipo_tramite || null;
  const tipoDocumento = doc.tipo_documento || null;

  const labelTramite = getTramiteLabel(tipoTramite);
  const labelDoc = getDocumentoLabel(tipoDocumento);

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

  const formattedFecha = doc.created_at
    ? new Date(doc.created_at).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const estadoLabel = STATUS_LABELS[doc.status] || doc.status || "Sin estado";
  const estadoColor = STATUS_COLORS[doc.status] || "#6b7280";

  const handleVerPdf = async () => {
    try {
      const res = await fetch(`${API_URL}/api/docs/${doc.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudo obtener el PDF");
      }

      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Error abriendo PDF:", err);
      alert("❌ " + err.message);
    }
  };

  const handleVerRechazo = () => {
    if (!doc.reject_reason) {
      alert("Este documento no tiene motivo de rechazo.");
      return;
    }
    alert("Motivo de rechazo:\n\n" + doc.reject_reason);
  };

  return (
    <tr className="doc-row" onClick={() => onOpenDetail(doc)}>
      {/* N° interno de contrato */}
      <td className="doc-cell-id">
        {doc.numero_contrato_interno || `#${doc.id}`}
      </td>

      {/* Título + fecha */}
      <td className="doc-cell-title">
        <div className="doc-title-main">
          {doc.title || "Sin título"}
        </div>
        <div className="doc-title-sub">{formattedFecha}</div>
      </td>

      {/* Tipo de trámite + tipo de documento */}
      <td>
        <span
          className="doc-chip-tipo"
          style={{
            backgroundColor: chipBgColor,
            color: chipTextColor,
          }}
        >
          {labelTramite} · {labelDoc}
        </span>
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

      {/* Firmante principal */}
      <td className="doc-cell-signer">
        <div className="doc-signer-main">
          {doc.firmante_nombre || "No asignado"}
        </div>
      </td>

      {/* Acciones */}
      <td
        className="doc-cell-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="doc-actions">
          {doc.status === DOC_STATUS.RECHAZADO && doc.reject_reason && (
            <button
              type="button"
              className="btn-main btn-secondary-danger"
              onClick={handleVerRechazo}
            >
              Ver rechazo
            </button>
          )}

          <button
            type="button"
            className="btn-main"
            onClick={handleVerPdf}
          >
            Ver PDF
          </button>

          <button
            type="button"
            className="btn-main btn-primary"
            onClick={() => onOpenDetail(doc)}
          >
            Abrir documento
          </button>
        </div>
      </td>
    </tr>
  );
}
