import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { DOC_STATUS } from "../constants";
import { useToast } from "./useToast";

export function useDocuments(token) {
  const { addToast } = useToast();

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [docs, setDocs] = useState([]);

  const [sort, setSort] = useState("created_at");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const mapStatusFilterToApi = useCallback((value) => {
    if (value === "FIRMADOS") return DOC_STATUS.FIRMADO;
    if (value === "RECHAZADOS") return DOC_STATUS.RECHAZADO;
    return undefined;
  }, []);

  const mapSortToApi = useCallback((value) => {
    switch (value) {
      case "title_asc":
        return { sort: "title", order: "asc" };
      case "title_desc":
        return { sort: "title", order: "desc" };
      case "created_at_asc":
        return { sort: "created_at", order: "asc" };
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
      default:
        return { sort: "created_at", order: "desc" };
    }
  }, []);

  const cargarDocs = useCallback(
    async (sortParam = sort, pageParam = page) => {
      if (!token) {
        setDocs([]);
        setPagination({
          page: 1,
          limit: pageSize,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
        return;
      }

      setLoadingDocs(true);
      setErrorDocs("");

      try {
        const sortConfig = mapSortToApi(sortParam);

        const res = await api.get("/docs", {
          params: {
            sort: sortConfig.sort,
            order: sortConfig.order,
            page: pageParam,
            limit: pageSize,
            status: mapStatusFilterToApi(statusFilter),
            search: search.trim() || undefined,
          },
        });

        const payload = res.data;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const meta = payload?.pagination || {};

        setDocs(rows);
        setPagination({
          page: Number(meta.page) || pageParam,
          limit: Number(meta.limit) || pageSize,
          total: Number(meta.total) || 0,
          totalPages: Number(meta.totalPages) || 1,
          hasNextPage: Boolean(meta.hasNextPage),
          hasPrevPage: Boolean(meta.hasPrevPage),
        });
      } catch (err) {
        console.error("Fallo al cargar documentos:", err);

        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudieron cargar los documentos. Intenta nuevamente.";

        setErrorDocs(msg);
        setDocs([]);
        setPagination({
          page: 1,
          limit: pageSize,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
      } finally {
        setLoadingDocs(false);
      }
    },
    [sort, page, token, pageSize, statusFilter, search, mapStatusFilterToApi, mapSortToApi]
  );

  useEffect(() => {
    if (!token) {
      setDocs([]);
      setSelectedDoc(null);
      setPdfUrl(null);
      setPagination({
        page: 1,
        limit: pageSize,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
      return;
    }

    cargarDocs(sort, page);
  }, [token, sort, page, statusFilter, search, cargarDocs]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, sort]);

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

          if (!data || !data.url) {
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

        await cargarDocs(sort, page);
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
    [docs, cargarDocs, addToast, sort, page]
  );

  const docsFiltrados = useMemo(() => {
    return Array.isArray(docs) ? docs : [];
  }, [docs]);

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

  const docsPaginados = useMemo(() => {
    return docsFiltrados;
  }, [docsFiltrados]);

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
    pageSize,
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
  };
}