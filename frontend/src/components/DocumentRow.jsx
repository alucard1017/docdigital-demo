// src/components/DocumentRow.jsx
import React from "react";
import { DocStatusBadge } from "./DocStatusBadge";
import { DOC_STATUS } from "../constants";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function getTipoTramiteLabel(tipo) {
  if (tipo === "notaria") return "Trámite Notarial";
  if (tipo === "propio") return "Trámite Propio";
  return "N/D";
} 

export function DocumentRow({ doc, onOpenDetail, token }) {
  const tipoTramite = doc.tipo_tramite || doc.tipoTramite || null;

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
    <tr>
      {/* N° de contrato */}
      <td style={{ color: "#94a3b8", fontWeight: 600 }}>#{doc.id}</td>

      {/* Título */}
      <td style={{ fontWeight: 700, color: "#1e293b" }}>
        {doc.title || "Sin título"}
      </td>

      {/* Tipo de trámite */}
      <td>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 12,
            backgroundColor:
              tipoTramite === "notaria" ? "#eef2ff" : "#ecfeff",
            color:
              tipoTramite === "notaria" ? "#4f46e5" : "#0f766e",
            whiteSpace: "nowrap",
          }}
        >
          {getTipoTramiteLabel(tipoTramite)}
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
        <DocStatusBadge status={doc.status} />
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
