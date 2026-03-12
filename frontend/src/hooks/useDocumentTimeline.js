import { useEffect, useState } from "react";

export function useDocumentTimeline(documentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTimeline = async (signal) => {
    if (!documentId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/timeline`, {
        signal,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Error ${res.status} obteniendo timeline del documento`
        );
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("❌ Error en useDocumentTimeline:", err);
      setError(err.message || "Error obteniendo timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!documentId) return;

    const controller = new AbortController();
    fetchTimeline(controller.signal);

    return () => controller.abort();
  }, [documentId]);

  const reload = () => {
    const controller = new AbortController();
    fetchTimeline(controller.signal);
    return () => controller.abort();
  };

  return { data, loading, error, reload };
}
