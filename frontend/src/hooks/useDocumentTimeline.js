// src/hooks/useDocumentTimeline.js
import { useEffect, useState, useCallback } from "react";
import api from "../api/client";

export function useDocumentTimeline(documentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTimeline = useCallback(
    async (controller) => {
      if (!documentId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/docs/${documentId}/timeline`, {
          signal: controller?.signal,
        });

        setData(response.data);
      } catch (err) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;

        console.error("❌ Error en useDocumentTimeline:", err);

        const message =
          err.response?.data?.message ||
          err.message ||
          "Error obteniendo timeline";

        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [documentId]
  );

  useEffect(() => {
    if (!documentId) return;

    const controller = new AbortController();
    fetchTimeline(controller);

    return () => controller.abort();
  }, [documentId, fetchTimeline]);

  const reload = useCallback(() => {
    if (!documentId) return;
    const controller = new AbortController();
    fetchTimeline(controller);
    return () => controller.abort();
  }, [documentId, fetchTimeline]);

  return { data, loading, error, reload };
}