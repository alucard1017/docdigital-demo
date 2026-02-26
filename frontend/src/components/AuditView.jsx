// src/components/AuditView.jsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

const EVENT_TYPES = [
  { value: "", label: "Todos" },
  { value: "FIRMADO", label: "Firmado" },
  { value: "VISADO", label: "Visado" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "API_ACTION", label: "Acción API" },
];

export function AuditView({ token }) {
  const [eventType, setEventType] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (eventType) params.append("evento_tipo", eventType);
      params.append("limit", "200");

      const res = await fetch(`${API_URL}/api/docs/audit?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error cargando auditoría");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando auditoría:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  return (
    <div className="card-premium">
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Auditoría de documentos</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontSize: "0.85rem", color: "#64748b" }}>
          Tipo de evento:{" "}
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={{
              marginLeft: 8,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: "0.85rem",
            }}
          >
            {EVENT_TYPES.map((opt) => (
              <option key={opt.value || "ALL"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-main"
          onClick={fetchAudit}
          disabled={loading}
          style={{
            fontSize: "0.8rem",
            padding: "6px 12px",
            borderRadius: 6,
          }}
        >
          {loading ? "Actualizando..." : "🔄 Actualizar"}
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          Cargando auditoría...
        </p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          No hay registros de auditoría para los filtros seleccionados.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  Fecha
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  Evento
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  Documento
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  Usuario
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  Descripción
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(row.created_at).toLocaleString("es-CL")}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {row.evento_tipo}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {row.documento_id || "-"}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {row.usuario_id || "-"}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.descripcion || "-"}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {row.ip_address || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
