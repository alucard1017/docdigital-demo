import React from "react";
import { DocStatusBadge } from "./DocStatusBadge";
import { DOC_STATUS } from "../constants";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

export function DocumentRow({ doc, onOpenDetail }) {
  const handleVerPdf = () => {
    if (!doc.file_url) {
      alert("No se encontró la URL del contrato para este documento.");
      return;
    }

    const url = doc.file_url.startsWith("http")
      ? doc.file_url
      : `${API_URL}${doc.file_url}`;

    window.open(url, "_blank");
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
      <td style={{ color: "#94a3b8", fontWeight: 600 }}>#{doc.id}</td>

      <td style={{ fontWeight: 700, color: "#1e293b" }}>
        {doc.title || "Sin título"}
      </td>

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

      <td style={{ textAlign: "center" }}>
        <DocStatusBadge status={doc.status} />
      </td>

      <td>{doc.firmante_nombre || "No asignado"}</td>

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
