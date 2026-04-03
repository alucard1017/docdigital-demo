import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client";
import { DOC_STATUS } from "../constants";
import { useToast } from "./useToast";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function useDebouncedValue(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function mapStatusFilterToApi(value) {
  if (!value || value === "TODOS") return undefined;

  switch (value) {
    case "PENDIENTES":
      return "PENDIENTES";
    case "VISADOS":
      return DOC_STATUS.VISADO;
    case "FIRMADOS":
      return DOC_STATUS.FIRMADO;
    case "RECHAZADOS":
      return DOC_STATUS.RECHAZADO;
    default:
      return undefined;
  }
}

function mapSortToApi(value) {
  switch (value) {
    case "title_asc":
      return { sort: "title", order: "asc" };
    case "title_desc":
      return { sort: "title", order: "desc" };
    case "fecha_asc":
    case "created_at_asc":
      return { sort: "created_at", order: "asc" };
    case "fecha_desc":
    case "created_at_desc":
      return { sort: "created_at", order: "desc" };
    case "updated_at_asc":
      return { sort: "updated_at", order: "asc" };
    case "updated_at_desc":
      return { sort: "updated_at", order: "desc" };
    case "status_asc":
      return { sort: "status", order: "asc" };
    case "status_desc":
      return { sort: "status", order: "desc" };
    case "numero_asc":
      return { sort: "numero_contrato_interno", order: "asc" };
    case "numero_desc":
      return { sort: "numero_contrato_interno", order: "desc" };
    default:
      return { sort: "created_at", order: "desc" };
  }
}

export function useDocuments(token) {
  const { addToast } = useToast();

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [docs, setDocs] = useState([]);

  const [sort, setSort] = useState("created_at_desc");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [page, setPage] = useState(1);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const latestRequestRef = useRef(0);

  const resetState = useCallback(() => {
    setDocs([]);
    setSelectedDoc(null);
    setPdfUrl(null);
    setPagination({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  }, []);

  const cargarDocs = useCallback(
    async ({
      page: pageArg,
      sort: sortArg,
      statusFilter: statusArg,
      search: searchArg,
    } = {}) => {
      if (!token) {
        resetState();
        return;
      }

      const currentPage = pageArg ?? page;
      const currentSort = sortArg ?? sort;
      const currentStatus = statusArg ?? statusFilter;
      const currentSearch = searchArg ?? debouncedSearch;

      const sortConfig = mapSortToApi(currentSort);
      const apiStatus = mapStatusFilterToApi(currentStatus);
      const trimmedSearch = (currentSearch || "").trim();

      const params = {
        sort: sortConfig.sort,
        order: sortConfig.order,
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (apiStatus) {
        params.status = apiStatus;
      }

      if (trimmedSearch) {
        params.search = trimmedSearch;
      }

      const requestId = Date.now();
      latestRequestRef.current = requestId;

      setLoadingDocs(true);
      setErrorDocs("");

      try {
        console.log("[useDocuments] GET /docs params:", params);

        const res = await api.get("/docs", { params });

        if (latestRequestRef.current !== requestId) {
          return;
        }

        const payload = res?.data || {};
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const meta = payload.pagination || {};

        const safePage = Number(meta.page) || currentPage;
        const safeLimit = Number(meta.limit) || PAGE_SIZE;
        const safeTotal = Number(meta.total) || rows.length;
        const safeTotalPages = Number(meta.totalPages) || 1;

        setDocs(rows);
        setPagination({
          page: safePage,
          limit: safeLimit,
          total: safeTotal,
          totalPages: safeTotalPages,
          hasNextPage:
            typeof meta.hasNextPage === "boolean"
              ? meta.hasNextPage
              : safePage < safeTotalPages,
          hasPrevPage:
            typeof meta.hasPrevPage === "boolean"
              ? meta.hasPrevPage
              : safePage > 1,
        });
      } catch (err) {
        if (latestRequestRef.current !== requestId) {
          return;
        }

        console.error("Fallo al cargar documentos:", err);

        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudieron cargar los documentos. Intenta nuevamente.";

        setErrorDocs(msg);
        resetState();
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoadingDocs(false);
        }
      }
    },
    [token, page, sort, statusFilter, debouncedSearch, resetState]
  );

  useEffect(() => {
    if (!token) {
      resetState();
      return;
    }

    cargarDocs({
      page,
      sort,
      statusFilter,
      search: debouncedSearch,
    });
  }, [token, page, sort, statusFilter, debouncedSearch, cargarDocs, resetState]);

  const updateSort = useCallback((value) => {
    setPage(1);
    setSort(value);
  }, []);

  const updateStatusFilter = useCallback((value) => {
    setPage(1);
    setStatusFilter(value);
  }, []);

  const updateSearch = useCallback((value) => {
    setPage(1);
    setSearch(value);
  }, []);

  useEffect(() => {
    if (!selectedDoc?.id) {
      setPdfUrl(null);
      return;
    }

    let objectUrl;

    (async () => {
      try {
        const res = await api.get(`/documents/${selectedDoc.id}/preview`, {
          responseType: "blob",
        });

        const blob = new Blob([res.data], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        console.error("Error preparando URL de PDF:", err);
        setPdfUrl(null);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedDoc?.id]);

  const manejarAccionDocumento = useCallback(
    async (id, accion, extraData = {}) => {
      const safeDocs = Array.isArray(docs) ? docs : [];

      if (accion === "ver") {
        const doc = safeDocs.find((d) => d.id === id);

        if (!doc) {
          addToast({
            type: "error",
            title: "Documento no encontrado",
            message: "No se encontró el documento seleccionado",
          });
          return false;
        }

        try {
          const res = await api.get(`/docs/${doc.id}/pdf`);
          const data = res.data;

          if (!data?.url) {
            throw new Error("No se pudo obtener el PDF");
          }

          window.open(data.url, "_blank", "noopener,noreferrer");
          return true;
        } catch (err) {
          console.error("Error abriendo PDF:", err);

          const msg =
            err.response?.data?.message ||
            err.message ||
            "No se pudo abrir el PDF";

          addToast({
            type: "error",
            title: "No se pudo abrir el PDF",
            message: msg,
          });

          return false;
        }
      }

      try {
        let body;

        if (accion === "rechazar") {
          body = { motivo: extraData.motivo };
        }

        const res = await api.post(`/docs/${id}/${accion}`, body);
        const data = res.data;

        if (accion === "firmar") {
          addToast({
            type: "success",
            title: "Documento firmado",
            message: "El documento se firmó correctamente",
          });
        } else if (accion === "visar") {
          addToast({
            type: "success",
            title: "Documento visado",
            message: "El documento se visó correctamente",
          });
        } else if (accion === "rechazar") {
          addToast({
            type: "success",
            title: "Documento rechazado",
            message: "El documento se rechazó correctamente",
          });
        } else if (data?.message) {
          addToast({
            type: "success",
            title: "Operación completada",
            message: data.message,
          });
        }

        await cargarDocs({
          page,
          sort,
          statusFilter,
          search: debouncedSearch,
        });

        setSelectedDoc(null);
        return true;
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudo procesar la acción";

        addToast({
          type: "error",
          title: "No se pudo procesar la acción",
          message: msg,
        });

        return false;
      }
    },
    [docs, addToast, cargarDocs, page, sort, statusFilter, debouncedSearch]
  );

  const docsFiltrados = useMemo(() => {
    return Array.isArray(docs) ? docs : [];
  }, [docs]);

  const docsPaginados = useMemo(() => docsFiltrados, [docsFiltrados]);

  const pendientes = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];

    return safeDocs.filter((d) => {
      const status = d?.status;
      return (
        status === DOC_STATUS.PENDIENTE ||
        status === DOC_STATUS.PENDIENTE_VISADO ||
        status === DOC_STATUS.PENDIENTE_FIRMA
      );
    }).length;
  }, [docs]);

  const visados = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];
    return safeDocs.filter((d) => d?.status === DOC_STATUS.VISADO).length;
  }, [docs]);

  const firmados = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];
    return safeDocs.filter((d) => d?.status === DOC_STATUS.FIRMADO).length;
  }, [docs]);

  const rechazados = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];
    return safeDocs.filter((d) => d?.status === DOC_STATUS.RECHAZADO).length;
  }, [docs]);

  const totalFiltrado = Number.isFinite(pagination.total)
    ? pagination.total
    : docsFiltrados.length;

  const totalPaginas =
    Number.isFinite(pagination.totalPages) && pagination.totalPages > 0
      ? pagination.totalPages
      : 1;

  return {
    loadingDocs,
    errorDocs,
    docs,
    sort,
    setSort: updateSort,
    statusFilter,
    setStatusFilter: updateStatusFilter,
    search,
    setSearch: updateSearch,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    selectedDoc,
    setSelectedDoc,
    pdfUrl,
    cargarDocs,
    manejarAccionDocumento,
    docsFiltrados,
    docsPaginados,
    pendientes,
    visados,
    firmados,
    rechazados,
    totalFiltrado,
    totalPaginas,
    pagination,
    debouncedSearch,
  };
}