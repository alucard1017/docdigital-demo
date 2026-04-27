// src/components/ListHeader.jsx
import React, { useCallback, useMemo } from "react";
import { Download, RefreshCw, Search, X, ArrowUpDown, Filter } from "lucide-react";
import { API_BASE_URL } from "../constants";
import { useToast } from "../hooks/useToast";
import "../styles/decorativeTabs.css";
import "../styles/listHeader.css";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  return `${API_URL.replace(/\/+$/, "")}/api${path}`;
}

function safeCount(value) {
  return Number.isFinite(value) ? value : 0;
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
  const { addToast } = useToast();

  const _pendientes = safeCount(pendientes);
  const _visados = safeCount(visados);
  const _firmados = safeCount(firmados);
  const _rechazados = safeCount(rechazados);

  // Si viene totalFiltrado desde fuera, úsalo como fuente de verdad.
  const total = useMemo(() => {
    if (Number.isFinite(totalFiltrado)) return totalFiltrado;
    return _pendientes + _visados + _firmados + _rechazados;
  }, [_pendientes, _visados, _firmados, _rechazados, totalFiltrado]);

  const handleDownloadReport = useCallback(async () => {
    if (!token) {
      addToast({
        type: "warning",
        title: "Sesión no disponible",
        message: "No hay sesión activa para descargar el reporte.",
      });
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

        addToast({
          type: "error",
          title: "No se pudo descargar",
          message: msg,
        });
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

      addToast({
        type: "success",
        title: "Reporte generado",
        message: "La descarga del reporte comenzó correctamente.",
      });
    } catch (err) {
      console.error("Error descargando reporte:", err);

      addToast({
        type: "error",
        title: "Error de conexión",
        message: "No se pudo descargar el reporte en este momento.",
      });
    }
  }, [token, addToast]);

  const handleClearSearch = useCallback(() => {
    setSearch("");
  }, [setSearch]);

  return (
    <section className="list-header-card">
      {/* Línea superior */}
      <div className="list-header-top">
        <div className="list-header-copy">
          <h1 className="list-header-title">Bandeja de entrada</h1>

          <p className="list-header-subtitle">
            Gestiona documentos, revisa estados y accede rápido a las acciones
            principales.
          </p>

          <p className="list-header-results">
            {totalFiltrado} documentos encontrados con los filtros actuales
          </p>
        </div>

        <div className="list-header-actions">
          <button
            type="button"
            onClick={handleDownloadReport}
            className="btn-main list-header-btn-success"
          >
            <Download size={16} />
            <span>Descargar reporte</span>
          </button>

          <button
            className="btn-main list-header-btn-sync"
            onClick={onSync}
            type="button"
          >
            <RefreshCw size={16} />
            <span>Sincronizar bandeja</span>
          </button>
        </div>
      </div>

      {/* Chips de estado */}
      <div className="list-header-chips">
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          className={`status-chip status-chip--neutral ${
            statusFilter === "TODOS" ? "is-active" : ""
          }`}
        >
          <span>Todos</span>
          <strong>{total}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDIENTES")}
          className={`status-chip status-chip--pending ${
            statusFilter === "PENDIENTES" ? "is-active" : ""
          }`}
        >
          <span>Pendientes</span>
          <strong>{_pendientes}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("VISADOS")}
          className={`status-chip status-chip--teal ${
            statusFilter === "VISADOS" ? "is-active" : ""
          }`}
        >
          <span>Visados</span>
          <strong>{_visados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("FIRMADOS")}
          className={`status-chip status-chip--success ${
            statusFilter === "FIRMADOS" ? "is-active" : ""
          }`}
        >
          <span>Firmados</span>
          <strong>{_firmados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("RECHAZADOS")}
          className={`status-chip status-chip--danger ${
            statusFilter === "RECHAZADOS" ? "is-active" : ""
          }`}
        >
          <span>Rechazados</span>
          <strong>{_rechazados}</strong>
        </button>
      </div>

      {/* Filtros */}
      <div className="list-header-filters">
        <div className="list-filter-group">
          <span className="list-filter-label">
            <ArrowUpDown size={14} />
            <span>Ordenar</span>
          </span>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="list-filter-control"
          >
            <option value="title_asc">Título (A → Z)</option>
            <option value="title_desc">Título (Z → A)</option>
            <option value="fecha_desc">Fecha (más reciente)</option>
            <option value="fecha_asc">Fecha (más antigua)</option>
            <option value="numero_asc">N° interno (ascendente)</option>
            <option value="numero_desc">N° interno (descendente)</option>
          </select>
        </div>

        <div className="list-filter-group">
          <span className="list-filter-label">
            <Filter size={14} />
            <span>Estado</span>
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="list-filter-control"
          >
            <option value="TODOS">Todos</option>
            <option value="PENDIENTES">Pendientes</option>
            <option value="VISADOS">Visados</option>
            <option value="FIRMADOS">Firmados</option>
            <option value="RECHAZADOS">Rechazados</option>
          </select>
        </div>

        <div className="list-filter-group list-filter-group--search">
          <span className="list-filter-label">
            <Search size={14} />
            <span>Buscar</span>
          </span>

          <div className="list-search-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Título, participante o empresa..."
              className="list-filter-control list-filter-control--input"
            />

            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Limpiar búsqueda"
                className="list-search-clear"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}