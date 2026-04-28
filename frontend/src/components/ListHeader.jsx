// src/components/ListHeader.jsx
import React, { useCallback, useMemo } from "react";
import {
  Download,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../constants";
import { useToast } from "../hooks/useToast";
import "../styles/decorativeTabs.css";
import "../styles/listHeader.css";

const API_URL = API_BASE_URL;

function apiUrl(path) {
  const base = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
  return `${base}/api${path}`;
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
  const { t } = useTranslation();
  const { addToast } = useToast();

  const _pendientes = safeCount(pendientes);
  const _visados = safeCount(visados);
  const _firmados = safeCount(firmados);
  const _rechazados = safeCount(rechazados);

  const total = useMemo(() => {
    if (Number.isFinite(totalFiltrado)) return totalFiltrado;
    return _pendientes + _visados + _firmados + _rechazados;
  }, [_pendientes, _visados, _firmados, _rechazados, totalFiltrado]);

  const handleDownloadReport = useCallback(async () => {
    if (!token) {
      addToast({
        type: "warning",
        title: t(
          "listHeader.toasts.noSessionTitle",
          "Sesión no disponible"
        ),
        message: t(
          "listHeader.toasts.noSessionMessage",
          "No hay sesión activa para descargar el reporte."
        ),
      });
      return;
    }

    try {
      const res = await fetch(apiUrl("/docs/export/excel"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let msg = t(
          "listHeader.toasts.downloadErrorFallback",
          "Error descargando reporte"
        );

        try {
          const data = await res.json();
          msg = data?.message || msg;
        } catch {
          // ignore
        }

        addToast({
          type: "error",
          title: t(
            "listHeader.toasts.downloadErrorTitle",
            "No se pudo descargar"
          ),
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
        title: t(
          "listHeader.toasts.downloadSuccessTitle",
          "Reporte generado"
        ),
        message: t(
          "listHeader.toasts.downloadSuccessMessage",
          "La descarga del reporte comenzó correctamente."
        ),
      });
    } catch (err) {
      console.error("Error descargando reporte:", err);

      addToast({
        type: "error",
        title: t(
          "listHeader.toasts.connectionErrorTitle",
          "Error de conexión"
        ),
        message: t(
          "listHeader.toasts.connectionErrorMessage",
          "No se pudo descargar el reporte en este momento."
        ),
      });
    }
  }, [token, addToast, t]);

  const handleClearSearch = useCallback(() => {
    setSearch("");
  }, [setSearch]);

  return (
    <section className="list-header-card">
      <div className="list-header-top">
        <div className="list-header-copy">
          <h1 className="list-header-title">
            {t("listHeader.title", "Bandeja de entrada")}
          </h1>

          <p className="list-header-subtitle">
            {t(
              "listHeader.subtitle",
              "Gestiona documentos, revisa estados y accede rápido a las acciones principales."
            )}
          </p>

          <p className="list-header-results">
            {t(
              "listHeader.results",
              "{{count}} documentos encontrados con los filtros actuales",
              { count: totalFiltrado ?? 0 }
            )}
          </p>
        </div>

        <div className="list-header-actions">
          <button
            type="button"
            onClick={handleDownloadReport}
            className="btn-main list-header-btn-success"
          >
            <Download size={16} aria-hidden="true" />
            <span>
              {t(
                "listHeader.actions.downloadReport",
                "Descargar reporte"
              )}
            </span>
          </button>

          <button
            type="button"
            className="btn-main list-header-btn-sync"
            onClick={onSync}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>
              {t("listHeader.actions.syncInbox", "Sincronizar bandeja")}
            </span>
          </button>
        </div>
      </div>

      <div className="list-header-chips">
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          className={`status-chip status-chip--neutral ${
            statusFilter === "TODOS" ? "is-active" : ""
          }`}
        >
          <span>{t("listHeader.chips.all", "Todos")}</span>
          <strong>{total}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDIENTES")}
          className={`status-chip status-chip--pending ${
            statusFilter === "PENDIENTES" ? "is-active" : ""
          }`}
        >
          <span>{t("listHeader.chips.pending", "Pendientes")}</span>
          <strong>{_pendientes}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("VISADOS")}
          className={`status-chip status-chip--teal ${
            statusFilter === "VISADOS" ? "is-active" : ""
          }`}
        >
          <span>{t("listHeader.chips.visa", "Visados")}</span>
          <strong>{_visados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("FIRMADOS")}
          className={`status-chip status-chip--success ${
            statusFilter === "FIRMADOS" ? "is-active" : ""
          }`}
        >
          <span>{t("listHeader.chips.signed", "Firmados")}</span>
          <strong>{_firmados}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("RECHAZADOS")}
          className={`status-chip status-chip--danger ${
            statusFilter === "RECHAZADOS" ? "is-active" : ""
          }`}
        >
          <span>{t("listHeader.chips.rejected", "Rechazados")}</span>
          <strong>{_rechazados}</strong>
        </button>
      </div>

      <div className="list-header-filters">
        <div className="list-filter-group">
          <span className="list-filter-label">
            <ArrowUpDown size={14} aria-hidden="true" />
            <span>{t("listHeader.filters.sort.label", "Ordenar")}</span>
          </span>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="list-filter-control"
          >
            <option value="title_asc">
              {t("listHeader.filters.sort.titleAsc", "Título (A → Z)")}
            </option>
            <option value="title_desc">
              {t("listHeader.filters.sort.titleDesc", "Título (Z → A)")}
            </option>
            <option value="fecha_desc">
              {t(
                "listHeader.filters.sort.dateDesc",
                "Fecha (más reciente)"
              )}
            </option>
            <option value="fecha_asc">
              {t(
                "listHeader.filters.sort.dateAsc",
                "Fecha (más antigua)"
              )}
            </option>
            <option value="numero_asc">
              {t(
                "listHeader.filters.sort.numberAsc",
                "N° interno (ascendente)"
              )}
            </option>
            <option value="numero_desc">
              {t(
                "listHeader.filters.sort.numberDesc",
                "N° interno (descendente)"
              )}
            </option>
          </select>
        </div>

        <div className="list-filter-group">
          <span className="list-filter-label">
            <Filter size={14} aria-hidden="true" />
            <span>{t("listHeader.filters.status.label", "Estado")}</span>
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="list-filter-control"
          >
            <option value="TODOS">
              {t("listHeader.filters.status.all", "Todos")}
            </option>
            <option value="PENDIENTES">
              {t("listHeader.filters.status.pending", "Pendientes")}
            </option>
            <option value="VISADOS">
              {t("listHeader.filters.status.visa", "Visados")}
            </option>
            <option value="FIRMADOS">
              {t("listHeader.filters.status.signed", "Firmados")}
            </option>
            <option value="RECHAZADOS">
              {t("listHeader.filters.status.rejected", "Rechazados")}
            </option>
          </select>
        </div>

        <div className="list-filter-group list-filter-group--search">
          <span className="list-filter-label">
            <Search size={14} aria-hidden="true" />
            <span>{t("listHeader.filters.search.label", "Buscar")}</span>
          </span>

          <div className="list-search-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "listHeader.filters.search.placeholder",
                "Título, participante o empresa..."
              )}
              className="list-filter-control list-filter-control--input"
            />

            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label={t(
                  "listHeader.filters.search.clear",
                  "Limpiar búsqueda"
                )}
                className="list-search-clear"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}