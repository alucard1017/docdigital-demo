import React, { useCallback, useMemo } from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  return `${API_URL.replace(/\/+$/, "")}/api${path}`;
}

const CHIP_BASE_STYLE = {
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: "0.8rem",
  fontWeight: 700,
  border: "1px solid transparent",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
  minHeight: 36,
  transition: "all 0.2s ease",
};

const CONTROL_BASE_STYLE = {
  height: 38,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid #334155",
  fontSize: "0.85rem",
  background: "#0f172a",
  color: "#e5e7eb",
  outline: "none",
  minWidth: 0,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const SECTION_CARD_STYLE = {
  background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.96))",
  border: "1px solid rgba(51,65,85,0.7)",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 14px 34px rgba(2,6,23,0.28)",
};

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
  const total = useMemo(
    () =>
      (Number.isFinite(pendientes) ? pendientes : 0) +
      (Number.isFinite(visados) ? visados : 0) +
      (Number.isFinite(firmados) ? firmados : 0) +
      (Number.isFinite(rechazados) ? rechazados : 0),
    [pendientes, visados, firmados, rechazados]
  );

  const handleDownloadReport = useCallback(async () => {
    if (!token) {
      alert("No hay sesión activa para descargar el reporte.");
      return;
    }

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
          msg = data?.message || msg;
        } catch {
          // ignore
        }
        alert(`❌ ${msg}`);
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
  }, [token]);

  const handleClearSearch = useCallback(() => {
    setSearch("");
  }, [setSearch]);

  return (
    <div style={SECTION_CARD_STYLE}>
      {/* Línea superior */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 240 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Bandeja de entrada
          </h1>

          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.9rem",
              color: "#94a3b8",
            }}
          >
            Gestiona documentos, revisa estados y accede rápido a las acciones
            principales.
          </p>

          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "0.82rem",
              color: "#cbd5e1",
            }}
          >
            {totalFiltrado} documentos encontrados con los filtros actuales
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            flex: "0 1 auto",
          }}
        >
          <button
            type="button"
            onClick={handleDownloadReport}
            className="btn-main"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              fontSize: "0.84rem",
              padding: "0 16px",
              borderRadius: 12,
              fontWeight: 700,
              border: "none",
              height: 38,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 24px rgba(5,150,105,0.28)",
            }}
          >
            Descargar reporte
          </button>

          <button
            className="btn-main"
            onClick={onSync}
            type="button"
            style={{
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: "0.84rem",
              padding: "0 16px",
              borderRadius: 12,
              fontWeight: 700,
              border: "1px solid #334155",
              height: 38,
              whiteSpace: "nowrap",
            }}
          >
            Sincronizar bandeja
          </button>
        </div>
      </div>

      {/* Chips de estado */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          style={{
            ...CHIP_BASE_STYLE,
            background:
              statusFilter === "TODOS"
                ? "linear-gradient(135deg, #1e293b, #334155)"
                : "rgba(15,23,42,0.9)",
            color: "#e5e7eb",
            borderColor: statusFilter === "TODOS" ? "#64748b" : "#1f2937",
          }}
        >
          Todos <strong>{total}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDIENTES")}
          style={{
            ...CHIP_BASE_STYLE,
            background:
              statusFilter === "PENDIENTES"
                ? "linear-gradient(135deg, #3730a3, #4f46e5)"
                : "rgba(55,48,163,0.18)",
            color: "#e5e7eb",
            borderColor: "rgba(129,140,248,0.7)",
          }}
        >
          Pendientes <strong>{pendientes}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("VISADOS")}
          style={{
            ...CHIP_BASE_STYLE,
            background:
              statusFilter === "VISADOS"
                ? "linear-gradient(135deg, #0f766e, #14b8a6)"
                : "rgba(15,118,110,0.18)",
            color: "#ecfeff",
            borderColor: "rgba(45,212,191,0.7)",
          }}
        >
          Visados <strong>{visados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("FIRMADOS")}
          style={{
            ...CHIP_BASE_STYLE,
            background:
              statusFilter === "FIRMADOS"
                ? "linear-gradient(135deg, #166534, #22c55e)"
                : "rgba(22,101,52,0.18)",
            color: "#dcfce7",
            borderColor: "rgba(34,197,94,0.7)",
          }}
        >
          Firmados <strong>{firmados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("RECHAZADOS")}
          style={{
            ...CHIP_BASE_STYLE,
            background:
              statusFilter === "RECHAZADOS"
                ? "linear-gradient(135deg, #b91c1c, #ef4444)"
                : "rgba(185,28,28,0.18)",
            color: "#fee2e2",
            borderColor: "rgba(248,113,113,0.7)",
          }}
        >
          Rechazados <strong>{rechazados}</strong>
        </button>
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 1 auto",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              minWidth: 64,
            }}
          >
            Ordenar
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ ...CONTROL_BASE_STYLE, minWidth: 190 }}
          >
            <option value="title_asc">Título (A → Z)</option>
            <option value="title_desc">Título (Z → A)</option>
            <option value="fecha_desc">Fecha (más reciente)</option>
            <option value="fecha_asc">Fecha (más antigua)</option>
            <option value="numero_asc">N° interno (ascendente)</option>
            <option value="numero_desc">N° interno (descendente)</option>
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 1 auto",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              minWidth: 52,
            }}
          >
            Estado
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...CONTROL_BASE_STYLE, minWidth: 160 }}
          >
            <option value="TODOS">Todos</option>
            <option value="PENDIENTES">Pendientes</option>
            <option value="VISADOS">Visados</option>
            <option value="FIRMADOS">Firmados</option>
            <option value="RECHAZADOS">Rechazados</option>
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 260px",
            minWidth: 220,
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              minWidth: 52,
            }}
          >
            Buscar
          </span>
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Título, participante o empresa..."
              style={{
                ...CONTROL_BASE_STYLE,
                width: "100%",
                paddingRight: search ? 32 : 12,
              }}
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Limpiar búsqueda"
                style={{
                  position: "absolute",
                  right: 8,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}