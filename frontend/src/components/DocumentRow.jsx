// src/components/DocumentRow.jsx
import React from "react";
import { DOC_STATUS } from "../constants";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function getTramiteLabel(value) {
  if (value === "notaria") return "Notaría";
  if (value === "propio") return "Propio";
  return "N/D";
}

function getDocumentoLabel(value) {
  if (value === "poderes") return "Poderes y autorizaciones";
  if (value === "contratos") return "Solo contratos";
  return "N/D";
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
  const tipoTramite = doc.tipo_tramite || doc.tipoTramite || null;
  const tipoDocumento = doc.tipo_documento || doc.tipoDocumento || null;

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

  const labelTramite = getTramiteLabel(tipoTramite);
  const labelDoc = getDocumentoLabel(tipoDocumento);

  return (
    <tr>
      {/* N° interno de contrato */}
      <td style={{ color: "#94a3b8", fontWeight: 600 }}>
        {doc.numero_contrato_interno || `#${doc.id}`}
      </td>

      {/* Título */}
      <td style={{ fontWeight: 700, color: "#1e293b" }}>
        {doc.title || "Sin título"}
      </td>

      {/* Tipo de trámite + tipo de documento */}
      <td>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: 12,
            backgroundColor: chipBgColor,
            color: chipTextColor,
            whiteSpace: "nowrap",
          }}
        >
          {labelTramite} – {labelDoc}
        </span>
      </td>

      {/* Fecha creación */}
      <td>
        {doc.created_at
          ? new Date(doc.created_at).toLocaleString("es-CO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-"}
      </td>

      {/* Estado */}
      <td style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: STATUS_COLORS[doc.status] || "#6b7280",
            whiteSpace: "nowrap",
          }}
        >
          {STATUS_LABELS[doc.status] || doc.status || "Sin estado"}
        </span>
      </td>

      {/* Firmante principal */}
      <td>{doc.firmante_nombre || "No asignado"}</td>

      {/* Acciones */}
      <td
        style={{
          verticalAlign: "middle",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {doc.status === DOC_STATUS.RECHAZADO && doc.reject_reason && (
            <button
              type="button"
              className="btn-main btn-secondary-danger"
              onClick={handleVerRechazo}
            >
              Ver rechazo
            </button>
          )}

          <button type="button" className="btn-main" onClick={handleVerPdf}>
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
