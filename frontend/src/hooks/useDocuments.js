// frontend/src/hooks/useDocuments.js
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

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export function useDocuments(token) {
  const { addToast } = useToast();

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [docs, setDocs] = useState([]);

  const [sort, setSortState] = useState("created_at_desc");
  const [statusFilter, setStatusFilterState] = useState("TODOS");
  const [search, setSearchState] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [page, setPageState] = useState(1);

  const [selectedDoc, setSelectedDoc] = useState(null);

  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const latestRequestRef = useRef(0);
  const lastQueryKeyRef = useRef("");
  const latestPreviewRequestRef = useRef(0);
  const currentObjectUrlRef = useRef(null);

  const cleanupPdfUrl = useCallback(() => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setPdfUrl(null);
  }, []);

  const resetState = useCallback(() => {
    setDocs([]);
    setSelectedDoc(null);
    cleanupPdfUrl();
    setPdfError("");
    setPagination({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  }, [cleanupPdfUrl]);

  const cargarDocs = useCallback(
    async ({
      page: pageArg = 1,
      sort: sortArg = "created_at_desc",
      statusFilter: statusArg = "TODOS",
      search: searchArg = "",
      force = false,
    } = {}) => {
      if (!token) {
        resetState();
        return;
      }

      const sortConfig = mapSortToApi(sortArg);
      const apiStatus = mapStatusFilterToApi(statusArg);

      const normalizedSearch =
        typeof searchArg === "string"
          ? searchArg
          : searchArg == null
          ? ""
          : String(searchArg);

      const trimmedSearch = normalizedSearch.trim();

      const params = {
        sort: sortConfig.sort,
        order: sortConfig.order,
        page: pageArg,
        limit: PAGE_SIZE,
      };

      if (apiStatus) params.status = apiStatus;
      if (trimmedSearch) params.search = trimmedSearch;

      const queryKey = JSON.stringify(params);

      if (!force && lastQueryKeyRef.current === queryKey) {
        return;
      }

      lastQueryKeyRef.current = queryKey;

      const requestId = Date.now();
      latestRequestRef.current = requestId;

      setLoadingDocs(true);
      setErrorDocs("");

      try {
        const res = await api.get("/docs", { params });

        if (latestRequestRef.current !== requestId) return;

        const payload = res?.data || {};
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const meta = payload?.pagination || {};

        const safePage = Number(meta.page) || pageArg;
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
        if (latestRequestRef.current !== requestId) return;

        console.error("Fallo al cargar documentos:", err);

        const msg = getErrorMessage(
          err,
          "No se pudieron cargar los documentos. Intenta nuevamente."
        );

        setErrorDocs(msg);
        resetState();

        addToast({
          type: "error",
          title: "Error al cargar documentos",
          message: msg,
        });
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoadingDocs(false);
        }
      }
    },
    [token, resetState, addToast]
  );

  const cargarPreviewPdf = useCallback(
    async (documentId) => {
      if (!documentId) {
        cleanupPdfUrl();
        setPdfError("");
        setLoadingPdf(false);
        return;
      }

      const requestId = Date.now();
      latestPreviewRequestRef.current = requestId;

      setLoadingPdf(true);
      setPdfError("");
      cleanupPdfUrl();

      try {
        const res = await api.get(`/documents/${documentId}/preview`, {
          responseType: "blob",
        });

        if (latestPreviewRequestRef.current !== requestId) return;

        const blob = new Blob([res.data], { type: "application/pdf" });
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrlRef.current = objectUrl;
        setPdfUrl(objectUrl);
      } catch (err) {
        if (latestPreviewRequestRef.current !== requestId) return;

        console.error("Error preparando URL de PDF:", err);

        const msg = getErrorMessage(
          err,
          "No se pudo cargar la vista previa del PDF."
        );

        setPdfError(msg);
        setPdfUrl(null);
      } finally {
        if (latestPreviewRequestRef.current === requestId) {
          setLoadingPdf(false);
        }
      }
    },
    [cleanupPdfUrl]
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

  useEffect(() => {
    if (!selectedDoc?.id) {
      cleanupPdfUrl();
      setPdfError("");
      setLoadingPdf(false);
      return;
    }

    cargarPreviewPdf(selectedDoc.id);

    return () => {
      latestPreviewRequestRef.current += 1;
    };
  }, [selectedDoc?.id, cargarPreviewPdf, cleanupPdfUrl]);

  useEffect(() => {
    return () => {
      cleanupPdfUrl();
    };
  }, [cleanupPdfUrl]);

  const setSort = useCallback((value) => {
    setPageState(1);
    setSortState(value);
  }, []);

  const setStatusFilter = useCallback((value) => {
    setPageState(1);
    setStatusFilterState(value);
  }, []);

  const setSearch = useCallback((value) => {
    setPageState(1);
    setSearchState(typeof value === "string" ? value : "");
  }, []);

  const setPage = useCallback((value) => {
    setPageState(value);
  }, []);

  const manejarAccionDocumento = useCallback(
    async (id, accion, extraData = {}) => {
      const safeDocs = Array.isArray(docs) ? docs : [];

      if (accion === "ver") {
        const doc = safeDocs.find((d) => d.id === id);

        if (!doc) {
          addToast({
            type: "error",
            title: "Documento no encontrado",
            message: "No se encontró el documento seleccionado.",
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

          addToast({
            type: "error",
            title: "No se pudo abrir el PDF",
            message: getErrorMessage(err, "No se pudo abrir el PDF."),
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
            message: "El documento se firmó correctamente.",
          });
        } else if (accion === "visar") {
          addToast({
            type: "success",
            title: "Documento visado",
            message: "El documento se visó correctamente.",
          });
        } else if (accion === "rechazar") {
          addToast({
            type: "success",
            title: "Documento rechazado",
            message: "El documento se rechazó correctamente.",
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
          force: true,
        });

        if (selectedDoc?.id === id) {
          await cargarPreviewPdf(id);
        }

        return true;
      } catch (err) {
        addToast({
          type: "error",
          title: "No se pudo procesar la acción",
          message: getErrorMessage(
            err,
            "No se pudo procesar la acción sobre el documento."
          ),
        });

        return false;
      }
    },
    [
      docs,
      addToast,
      cargarDocs,
      page,
      sort,
      statusFilter,
      debouncedSearch,
      selectedDoc?.id,
      cargarPreviewPdf,
    ]
  );

  const docsFiltrados = useMemo(
    () => (Array.isArray(docs) ? docs : []),
    [docs]
  );

  const docsPaginados = useMemo(() => docsFiltrados, [docsFiltrados]);

  const { pendientesCount, visados, firmados, rechazados } = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];

    const pendientes = safeDocs.filter((d) => {
      const status = d?.status;
      return (
        status === DOC_STATUS.PENDIENTE ||
        status === DOC_STATUS.PENDIENTE_VISADO ||
        status === DOC_STATUS.PENDIENTE_FIRMA
      );
    }).length;

    const visadosCount = safeDocs.filter(
      (d) => d?.status === DOC_STATUS.VISADO
    ).length;

    const firmadosCount = safeDocs.filter(
      (d) => d?.status === DOC_STATUS.FIRMADO
    ).length;

    const rechazadosCount = safeDocs.filter(
      (d) => d?.status === DOC_STATUS.RECHAZADO
    ).length;

    return {
      pendientesCount: pendientes,
      visados: visadosCount,
      firmados: firmadosCount,
      rechazados: rechazadosCount,
    };
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
    setSort,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    selectedDoc,
    setSelectedDoc,
    pdfUrl,
    loadingPdf,
    pdfError,
    cargarDocs,
    cargarPreviewPdf,
    manejarAccionDocumento,
    docsFiltrados,
    docsPaginados,
    pendientes: pendientesCount,
    visados,
    firmados,
    rechazados,
    totalFiltrado,
    totalPaginas,
    pagination,
    debouncedSearch,
  };
}