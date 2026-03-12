import React from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  return `${API_URL.replace(/\/+$/, "")}/api${path}`;
}

export function ListHeader({
  sort,
  setSort,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  totalFiltrado,
  pendientes,
  visados,
  firmados,
  rechazados,
  onSync,
  token,
}) {
  const handleDownloadReport = async () => {
    try {
      const res = await fetch(apiUrl("/docs/export/excel"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let msg = "Error descargando reporte";
        try {
          const data = await res.json();
          msg = data.message || msg;
        } catch (_) {}
        alert(msg);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documentos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error descargando reporte:", err);
      alert("Error de conexión al descargar reporte");
    }
  };

  const total = pendientes + visados + firmados + rechazados;

  return (
    <>
      {/* Resumen de estados */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          fontSize: "0.85rem",
        }}
      >
        {/* Todos */}
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: statusFilter === "TODOS" ? "#111827" : "#f3f4f6",
            color: statusFilter === "TODOS" ? "#f9fafb" : "#111827",
            cursor: "pointer",
          }}
        >
          Todos: <strong>{total}</strong>
        </button>

        {/* Pendientes */}
        <button
          type="button"
          onClick={() => setStatusFilter("PENDIENTES")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background:
              statusFilter === "PENDIENTES" ? "#3730a3" : "#eef2ff",
            color: statusFilter === "PENDIENTES" ? "#eef2ff" : "#3730a3",
            cursor: "pointer",
          }}
        >
          Pendientes: <strong>{pendientes}</strong>
        </button>

        {/* Visados */}
        <button
          type="button"
          onClick={() => setStatusFilter("VISADOS")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background:
              statusFilter === "VISADOS" ? "#0f766e" : "#ecfeff",
            color: statusFilter === "VISADOS" ? "#ecfeff" : "#0f766e",
            cursor: "pointer",
          }}
        >
          Visados: <strong>{visados}</strong>
        </button>

        {/* Firmados */}
        <button
          type="button"
          onClick={() => setStatusFilter("FIRMADOS")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background:
              statusFilter === "FIRMADOS" ? "#166534" : "#ecfdf3",
            color: statusFilter === "FIRMADOS" ? "#ecfdf3" : "#166534",
            cursor: "pointer",
          }}
        >
          Firmados: <strong>{firmados}</strong>
        </button>

        {/* Rechazados */}
        <button
          type="button"
          onClick={() => setStatusFilter("RECHAZADOS")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background:
              statusFilter === "RECHAZADOS" ? "#b91c1c" : "#fef2f2",
            color: statusFilter === "RECHAZADOS" ? "#fef2f2" : "#b91c1c",
            cursor: "pointer",
          }}
        >
          Rechazados: <strong>{rechazados}</strong>
        </button>
      </div>

      {/* Encabezado bandeja + filtros */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 30,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "2.1rem",
              fontWeight: 800,
            }}
          >
            Bandeja de Entrada
          </h1>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "0.85rem",
              color: "#6b7280",
            }}
          >
            {totalFiltrado} documentos encontrados con los filtros actuales
          </p>

          {/* Orden + filtros */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: "0.9rem",
              color: "#64748b",
              alignItems: "center",
            }}
          >
            {/* Ordenar por */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Ordenar por:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  fontSize: "0.9rem",
                }}
              >
                <option value="title_asc">Título (A → Z)</option>
                <option value="title_desc">Título (Z → A)</option>
                <option value="fecha_desc">Fecha (más reciente)</option>
                <option value="fecha_asc">Fecha (más antigua)</option>
                <option value="numero_asc">N° interno (ascendente)</option>
                <option value="numero_desc">N° interno (descendente)</option>
              </select>
            </div>

            {/* Filtro por estado (select) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  fontSize: "0.9rem",
                }}
              >
                <option value="TODOS">Todos</option>
                <option value="PENDIENTES">Pendientes</option>
                <option value="VISADOS">Visados</option>
                <option value="FIRMADOS">Firmados</option>
                <option value="RECHAZADOS">Rechazados</option>
              </select>
            </div>

            {/* Buscador */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexGrow: 1,
                minWidth: 200,
              }}
            >
              <span>Buscar:</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Título o empresa..."
                style={{
                  flexGrow: 1,
                  maxWidth: 260,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  fontSize: "0.9rem",
                }}
              />
            </div>
          </div>
        </div>

        {/* Botones de acciones */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <button
            type="button"
            className="btn-main"
            onClick={handleDownloadReport}
            style={{
              background: "#059669",
              color: "#ffffff",
              fontSize: "0.85rem",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📊 Descargar Reporte
          </button>

          <button className="btn-sync" onClick={onSync}>
            <span>🔄</span> Sincronizar Bandeja
          </button>
        </div>
      </div>
    </>
  );
}
