import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { DOC_STATUS } from "../constants";
import { useToast } from "./useToast";

export function useDocuments(token) {
  const { addToast } = useToast();

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [docs, setDocs] = useState([]);

  const [sort, setSort] = useState("title_asc");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const cargarDocs = useCallback(
    async (sortParam = sort) => {
      if (!token) {
        setDocs([]);
        return;
      }

      setLoadingDocs(true);
      setErrorDocs("");

      try {
        const res = await api.get("/docs", {
          params: { sort: sortParam },
        });

        const payload = res.data;
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        setDocs(rows);
      } catch (err) {
        console.error("Fallo al cargar documentos:", err);

        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudieron cargar los documentos. Intenta nuevamente.";

        setErrorDocs(msg);
        setDocs([]);
      } finally {
        setLoadingDocs(false);
      }
    },
    [sort, token]
  );

  useEffect(() => {
    if (!token) {
      setDocs([]);
      setSelectedDoc(null);
      setPdfUrl(null);
      return;
    }

    cargarDocs();
  }, [token, cargarDocs]);

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
          return;
        }

        try {
          const res = await api.get(`/docs/${doc.id}/pdf`);
          const data = res.data;

          if (!data || !data.url) {
            throw new Error("No se pudo obtener el PDF");
          }

          window.open(data.url, "_blank", "noopener,noreferrer");
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
        }

        return;
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

        await cargarDocs();
        setSelectedDoc(null);
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
      }
    },
    [docs, cargarDocs, addToast]
  );

  const docsFiltrados = useMemo(() => {
    const safeDocs = Array.isArray(docs) ? docs : [];

    return safeDocs.filter((d) => {
      const status = d?.status;

      const esPendiente =
        status === DOC_STATUS.PENDIENTE ||
        status === DOC_STATUS.PENDIENTE_VISADO ||
        status === DOC_STATUS.PENDIENTE_FIRMA;

      if (statusFilter === "PENDIENTES" && !esPendiente) return false;
      if (statusFilter === "FIRMADOS" && status !== DOC_STATUS.FIRMADO)
        return false;
      if (statusFilter === "RECHAZADOS" && status !== DOC_STATUS.RECHAZADO)
        return false;

      if (search.trim() !== "") {
        const q = search.toLowerCase();
        const titulo = String(d?.title || "").toLowerCase();
        const empresa = String(d?.destinatario_nombre || "").toLowerCase();

        if (!titulo.includes(q) && !empresa.includes(q)) return false;
      }

      return true;
    });
  }, [docs, statusFilter, search]);

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

  const totalFiltrado = Array.isArray(docsFiltrados) ? docsFiltrados.length : 0;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / pageSize));

  const docsPaginados = useMemo(() => {
    const safeDocsFiltrados = Array.isArray(docsFiltrados) ? docsFiltrados : [];
    return safeDocsFiltrados.slice((page - 1) * pageSize, page * pageSize);
  }, [docsFiltrados, page]);

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
  };
}
