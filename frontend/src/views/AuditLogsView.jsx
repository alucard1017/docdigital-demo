import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";

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

function normalizePaginatedResponse(data, currentPage, pageSize) {
  if (Array.isArray(data)) {
    const rows = data;

    return {
      rows,
      total: rows.length,
      page: currentPage,
      totalPages: rows.length < pageSize ? currentPage : currentPage + 1,
      hasNextPage: rows.length === pageSize,
    };
  }

  if (data && typeof data === "object") {
    const rows =
      data.logs || data.rows || data.items || data.data || data.results || [];
    const total = Number(data.total ?? rows.length) || rows.length;
    const page = Number(data.page ?? currentPage) || currentPage;
    const totalPages =
      Number(data.totalPages ?? Math.ceil(total / pageSize)) ||
      Math.max(1, Math.ceil(total / pageSize));
    const hasNextPage =
      typeof data.hasNextPage === "boolean"
        ? data.hasNextPage
        : page < totalPages;

    return {
      rows: Array.isArray(rows) ? rows : [],
      total,
      page,
      totalPages: Math.max(1, totalPages),
      hasNextPage,
    };
  }

  return {
    rows: [],
    total: 0,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
  };
}

function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [selectedLog, setSelectedLog] = useState(null);
  const [prettyMetadata, setPrettyMetadata] = useState("");

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeTotalPaginas =
    Number.isFinite(totalPaginas) && totalPaginas > 0 ? totalPaginas : 1;

  const cargarLogs = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError("");

      const params = {
        page: targetPage,
        limit: pageSize,
      };

      if (action) params.action = action;
      if (entityType) params.entity_type = entityType;
      if (userId.trim()) params.user_id = userId.trim();
      if (companyId.trim()) params.company_id = companyId.trim();

      try {
        const res = await api.get("/logs/audit", { params });
        const parsed = normalizePaginatedResponse(res?.data, targetPage, pageSize);

        setLogs(parsed.rows);
        setTotal(parsed.total);
        setTotalPaginas(parsed.totalPages);
        setHasNextPage(Boolean(parsed.hasNextPage));
        setPage(parsed.page);
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudieron cargar los logs de auditoría";

        setError(msg);
        setLogs([]);
        setTotal(0);
        setTotalPaginas(1);
        setHasNextPage(false);
      } finally {
        setLoading(false);
      }
    },
    [action, entityType, userId, companyId]
  );

  useEffect(() => {
    cargarLogs(1);
  }, [cargarLogs]);

  function handleFilterSubmit(e) {
    e.preventDefault();
    cargarLogs(1);
  }

  function handlePrevPage() {
    if (loading || safePage <= 1) return;
    cargarLogs(safePage - 1);
  }

  function handleNextPage() {
    if (loading || !hasNextPage) return;
    cargarLogs(safePage + 1);
  }

  function abrirMetadata(log) {
    setSelectedLog(log);

    try {
      if (log?.metadata) {
        const obj =
          typeof log.metadata === "string"
            ? JSON.parse(log.metadata)
            : log.metadata;
        setPrettyMetadata(JSON.stringify(obj, null, 2));
      } else {
        setPrettyMetadata("// Sin metadata adicional");
      }
    } catch {
      setPrettyMetadata("// No se pudo parsear metadata");
    }
  }

  function cerrarMetadata() {
    setSelectedLog(null);
    setPrettyMetadata("");
  }

  const summaryText = useMemo(() => {
    if (!logs.length) return "Sin resultados";
    return `Mostrando ${logs.length} eventos · Página ${safePage} de ${safeTotalPaginas} · Total ${total}`;
  }, [logs.length, safePage, safeTotalPaginas, total]);

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
        <button
          className="btn-main btn-primary"
          onClick={() => cargarLogs(safePage)}
        >
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

      {logs.length === 0 ? (
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
                  <th style={{ textAlign: "center", width: 120 }}>Usuario ID</th>
                  <th style={{ textAlign: "center", width: 120 }}>Empresa ID</th>
                  <th style={{ textAlign: "right", width: 140 }}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
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
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>{summaryText}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-main"
                disabled={loading || safePage <= 1}
                onClick={handlePrevPage}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn-main"
                disabled={loading || !hasNextPage}
                onClick={handleNextPage}
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
              ID log: {selectedLog.id} · Acción: {selectedLog.action} · Entidad:{" "}
              {selectedLog.entity_type}#{selectedLog.entity_id}
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

export default AuditLogsView;