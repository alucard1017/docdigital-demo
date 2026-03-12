// src/views/AuditLogsView.jsx
import { useEffect, useState } from "react";

const ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  { value: "document_created", label: "Documento creado" },
  { value: "document_signed", label: "Documento firmado" },
  { value: "document_rejected", label: "Documento rechazado" },
  { value: "user_created", label: "Usuario creado" },
  { value: "company_created", label: "Empresa creada" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "Todas las entidades" },
  { value: "document", label: "Documentos" },
  { value: "user", label: "Usuarios" },
  { value: "company", label: "Empresas" },
];

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogsView({ API_URL, token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [selectedLog, setSelectedLog] = useState(null);
  const [prettyMetadata, setPrettyMetadata] = useState("");

  async function cargarLogs() {
    if (!token) return;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entityType) params.set("entity_type", entityType);
    if (userId.trim()) params.set("user_id", userId.trim());
    if (companyId.trim()) params.set("company_id", companyId.trim());
    params.set("limit", String(500)); // tope razonable

    try {
      const res = await fetch(
        `${API_URL}/api/logs/audit?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(
          data.message || "No se pudieron cargar los logs de auditoría"
        );
      }
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar auditoría");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleFilterSubmit(e) {
    e.preventDefault();
    setPage(1);
    cargarLogs();
  }

  const total = logs.length;
  const totalPaginas = Math.ceil(total / pageSize) || 1;
  const logsPaginados = logs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  function abrirMetadata(log) {
    setSelectedLog(log);
    try {
      if (log && log.metadata) {
        const obj =
          typeof log.metadata === "string"
            ? JSON.parse(log.metadata)
            : log.metadata;
        setPrettyMetadata(JSON.stringify(obj, null, 2));
      } else {
        setPrettyMetadata("// Sin metadata adicional");
      }
    } catch (e) {
      setPrettyMetadata("// No se pudo parsear metadata");
    }
  }

  function cerrarMetadata() {
    setSelectedLog(null);
    setPrettyMetadata("");
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
          Cargando auditoría de negocio...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#b91c1c",
          }}
        >
          Error al cargar audit log
        </h2>
        <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#7f1d1d" }}>
          {error}
        </p>
        <button className="btn-main btn-primary" onClick={cargarLogs}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="card-premium">
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              marginTop: 0,
              marginBottom: 4,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Auditoría de negocio
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            Acciones sobre documentos, usuarios y empresas, ordenadas por fecha.
          </p>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            className="form-input"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="form-input"
            placeholder="Usuario ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ width: 110 }}
          />

          <input
            type="number"
            className="form-input"
            placeholder="Empresa ID"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            style={{ width: 120 }}
          />

          <button type="submit" className="btn-main btn-secondary">
            Aplicar filtros
          </button>
        </form>
      </div>

      {logsPaginados.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: 8,
            border: "1px dashed #cbd5f5",
            backgroundColor: "#f9fafb",
          }}
        >
          <p
            style={{
              marginTop: 0,
              marginBottom: 4,
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#0f172a",
            }}
          >
            No hay eventos de auditoría que coincidan con los filtros.
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            Prueba quitando filtros o espera a que se registren nuevas acciones.
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th style={{ textAlign: "center", width: 120 }}>
                    Usuario ID
                  </th>
                  <th style={{ textAlign: "center", width: 120 }}>
                    Empresa ID
                  </th>
                  <th style={{ textAlign: "right", width: 140 }}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logsPaginados.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>
                      <span
                        className={
                          log.action && log.action.includes("created")
                            ? "badge-plan badge-plan-pro"
                            : "badge-plan badge-plan-basic"
                        }
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 500,
                            color: "#0f172a",
                          }}
                        >
                          {log.entity_type || "—"}
                        </span>
                        {log.entity_id && (
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "#64748b",
                            }}
                          >
                            ID entidad: {log.entity_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {log.user_id ?? "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {log.company_id ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => abrirMetadata(log)}
                      >
                        Ver metadata
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              fontSize: "0.85rem",
            }}
          >
            <span>
              Mostrando {logsPaginados.length} de {total} eventos
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-main"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn-main"
                disabled={page === totalPaginas || totalPaginas === 0}
                onClick={() =>
                  setPage((p) => Math.min(totalPaginas, p + 1))
                }
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Detalle de metadata
              </h3>
              <button
                type="button"
                className="btn-link"
                onClick={cerrarMetadata}
              >
                Cerrar
              </button>
            </div>
            <p
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: "0.8rem",
                color: "#64748b",
              }}
            >
              ID log: {selectedLog.id} · Acción: {selectedLog.action} ·
              Entidad: {selectedLog.entity_type}#{selectedLog.entity_id}
            </p>
            <div
              style={{
                maxHeight: "400px",
                overflow: "auto",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                backgroundColor: "#0f172a",
                padding: 12,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "#e5e7eb",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
              >
                {prettyMetadata}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
