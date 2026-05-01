// src/components/DocumentTable.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import DocumentRow from "./DocumentRow";

export function DocumentTable({
  docs,
  loading,
  error,
  currentPage,
  totalPages,
  totalCount,
  onRetry,
  onChangePage,
  onOpenDetail,
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="list-state list-state--loading">
        <div className="list-state-title">
          {t(
            "app.list.loadingTitle",
            "Cargando tu bandeja de documentos…"
          )}
        </div>
        <p className="list-state-text">
          {t(
            "app.list.loadingSubtitle",
            "Esto puede tardar unos segundos."
          )}
        </p>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="list-state list-state--error">
        <p className="list-state-title">
          {t(
            "app.list.errorTitle",
            "Ocurrió un problema al cargar la bandeja."
          )}
        </p>
        <p className="list-state-text list-state-text--strong">
          {error ||
            t(
              "app.list.errorFallback",
              "Por favor, revisa tu conexión e inténtalo nuevamente."
            )}
        </p>
        <button
          type="button"
          className="btn-main btn-primary"
          onClick={onRetry}
        >
          {t("app.list.retry", "Reintentar carga")}
        </button>
      </div>
    );
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="list-state list-state--empty">
        <h3 className="list-state-title">
          {t(
            "app.list.emptyTitle",
            "No encontramos documentos para mostrar."
          )}
        </h3>
        <p className="list-state-text">
          {t(
            "app.list.emptySubtitle1",
            "Puede que no existan documentos con los filtros actuales."
          )}
        </p>
        <p className="list-state-text">
          {t(
            "app.list.emptySubtitle2",
            "Ajusta los filtros o crea un nuevo flujo de firma digital."
          )}
        </p>
      </div>
    );
  }

  const safeCurrentPage = Number(currentPage) || 1;
  const safeTotalPages = Number(totalPages) || 1;
  const safeTotalCount = Number(totalCount) || docs.length;

  return (
    <>
      <div className="table-wrapper">
        <table className="doc-table" role="table">
          <colgroup>
            <col className="col-title" />
            <col className="col-type" />
            <col className="col-status" />
            <col className="col-party" />
            <col className="col-actions" />
          </colgroup>

          <thead>
            <tr>
              <th scope="col" className="col-title">
                {t(
                  "app.table.columns.contractDocument",
                  "Contrato / Documento"
                )}
              </th>

              <th scope="col" className="col-type">
                {t("app.table.columns.type", "Tipo")}
              </th>

              <th scope="col" className="col-status text-center">
                {t("app.table.columns.status", "Estado")}
              </th>

              <th scope="col" className="col-party text-center">
		<span className="col-party-label">
                  {t("app.table.columns.participant", "Participante")}
		</span>
              </th>

              <th scope="col" className="col-actions text-center">
                <span className="col-actions-label">
                  {t("app.table.columns.actions", "Acciones")}
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="list-pagination">
        <span>
          {t(
            "app.pagination.summary",
            "Página {{current}} de {{total}} · {{count}} documentos",
            {
              current: safeCurrentPage,
              total: safeTotalPages,
              count: safeTotalCount,
            }
          )}
        </span>

        <div className="list-pagination-controls">
          <button
            type="button"
            className="btn-main"
            disabled={safeCurrentPage <= 1 || loading}
            onClick={() => onChangePage(safeCurrentPage - 1)}
          >
            {t("app.pagination.prev", "Anterior")}
          </button>

          <button
            type="button"
            className="btn-main"
            disabled={loading || safeCurrentPage >= safeTotalPages}
            onClick={() => onChangePage(safeCurrentPage + 1)}
          >
            {t("app.pagination.next", "Siguiente")}
          </button>
        </div>
      </div>
    </>
  );
}