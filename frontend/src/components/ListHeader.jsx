// src/components/ListHeader.jsx
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
      a.download = `documentos-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
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

  const chipBase = {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 600,
    border: "1px solid transparent",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    boxShadow: "0 8px 18px rgba(15,23,42,0.7)",
  };

  return (
    <>
      {/* Resumen de estados */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
          fontSize: "0.82rem",
        }}
      >
        {/* Todos */}
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          style={{
            ...chipBase,
            backgroundColor:
              statusFilter === "TODOS" ? "#111827" : "#020617",
            color: statusFilter === "TODOS" ? "#e5e7eb" : "#9ca3af",
            borderColor:
              statusFilter === "TODOS" ? "#4b5563" : "#1f2937",
          }}
        >
          <span style={{ opacity: 0.8 }}>Todos:</span>
          <strong>{total}</strong>
        </button>

        {/* Pendientes */}
        <button
          type="button"
          onClick={() => setStatusFilter("PENDIENTES")}
          style={{
            ...chipBase,
            backgroundColor:
              statusFilter === "PENDIENTES"
                ? "#3730a3"
                : "rgba(55,48,163,0.18)",
            color: "#e5e7eb",
            borderColor:
              statusFilter === "PENDIENTES"
                ? "#6366f1"
                : "rgba(129,140,248,0.6)",
          }}
        >
          <span>Pendientes:</span>
          <strong>{pendientes}</strong>
        </button>

        {/* Visados */}
        <button
          type="button"
          onClick={() => setStatusFilter("VISADOS")}
          style={{
            ...chipBase,
            backgroundColor:
              statusFilter === "VISADOS"
                ? "#0f766e"
                : "rgba(15,118,110,0.18)",
            color: "#ecfeff",
            borderColor:
              statusFilter === "VISADOS"
                ? "#14b8a6"
                : "rgba(45,212,191,0.7)",
          }}
        >
          <span>Visados:</span>
          <strong>{visados}</strong>
        </button>

        {/* Firmados */}
        <button
          type="button"
          onClick={() => setStatusFilter("FIRMADOS")}
          style={{
            ...chipBase,
            backgroundColor:
              statusFilter === "FIRMADOS"
                ? "#166534"
                : "rgba(22,101,52,0.2)",
            color: "#dcfce7",
            borderColor:
              statusFilter === "FIRMADOS"
                ? "#22c55e"
                : "rgba(34,197,94,0.7)",
          }}
        >
          <span>Firmados:</span>
          <strong>{firmados}</strong>
        </button>

        {/* Rechazados */}
        <button
          type="button"
          onClick={() => setStatusFilter("RECHAZADOS")}
          style={{
            ...chipBase,
            backgroundColor:
              statusFilter === "RECHAZADOS"
                ? "#b91c1c"
                : "rgba(185,28,28,0.2)",
            color: "#fee2e2",
            borderColor:
              statusFilter === "RECHAZADOS"
                ? "#f97373"
                : "rgba(248,113,113,0.7)",
          }}
        >
          <span>Rechazados:</span>
          <strong>{rechazados}</strong>
        </button>
      </div>

      {/* Encabezado bandeja + filtros */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          marginBottom: 26,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#e5e7eb",
            }}
          >
            Bandeja de Entrada
          </h1>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "0.85rem",
              color: "#9ca3af",
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
              fontSize: "0.85rem",
              color: "#9ca3af",
              alignItems: "center",
            }}
          >
            {/* Ordenar por */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Ordenar por:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid #1d4ed8",
                  fontSize: "0.85rem",
                  background: "#020617",
                  color: "#e5e7eb",
                  boxShadow:
                    "0 0 0 1px rgba(15,23,42,0.9), 0 8px 18px rgba(15,23,42,0.8)",
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
                gap: 6,
              }}
            >
              <span>Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid #1d4ed8",
                  fontSize: "0.85rem",
                  background: "#020617",
                  color: "#e5e7eb",
                  boxShadow:
                    "0 0 0 1px rgba(15,23,42,0.9), 0 8px 18px rgba(15,23,42,0.8)",
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
                gap: 6,
                flexGrow: 1,
                minWidth: 220,
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
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #1d4ed8",
                  fontSize: "0.85rem",
                  background: "#020617",
                  color: "#e5e7eb",
                  boxShadow:
                    "0 0 0 1px rgba(15,23,42,0.9), 0 8px 18px rgba(15,23,42,0.8)",
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
              background:
                "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              fontSize: "0.82rem",
              padding: "8px 16px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              boxShadow:
                "0 10px 26px rgba(5,150,105,0.55)",
            }}
          >
            📊 Descargar reporte
          </button>

          <button
            className="btn-sync"
            onClick={onSync}
            type="button"
          >
            <span>🔄</span> Sincronizar bandeja
          </button>
        </div>
      </div>
    </>
  );
}