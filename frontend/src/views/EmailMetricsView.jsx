// frontend/src/views/EmailMetricsView.jsx
import { useState, useEffect } from "react";
import api from "../api/client";

export default function EmailMetricsView() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentoId, setDocumentoId] = useState("");

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = documentoId ? { documentoId } : {};

      const res = await api.get("/analytics/email-metrics", { params });
      setMetrics(res.data);
    } catch (err) {
      console.error("Error cargando métricas:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error cargando métricas";
      setError(msg);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Cargando métricas...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Métricas de Emails</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <input
          type="number"
          placeholder="Filtrar por documento ID"
          value={documentoId}
          onChange={(e) => setDocumentoId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded"
        />
        <button
          onClick={fetchMetrics}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Filtrar
        </button>
        <button
          onClick={() => {
            setDocumentoId("");
            fetchMetrics();
          }}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Ver Todos
        </button>
      </div>

      {metrics && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-sm text-gray-600">Emails Enviados</div>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.summary?.emails_enviados ?? 0}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-sm text-gray-600">Tasa de Apertura</div>
              <div className="text-2xl font-bold text-green-600">
                {metrics.summary?.tasa_apertura ?? 0}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-sm text-gray-600">Tasa de Click</div>
              <div className="text-2xl font-bold text-purple-600">
                {metrics.summary?.tasa_click ?? 0}
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded">
              <div className="text-sm text-gray-600">Tasa de Rebote</div>
              <div className="text-2xl font-bold text-red-600">
                {metrics.summary?.tasa_rebote ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Entregados</div>
              <div className="text-xl font-bold">
                {metrics.summary?.emails_entregados ?? 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Abiertos</div>
              <div className="text-xl font-bold">
                {metrics.summary?.emails_abiertos ?? 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Clicados</div>
              <div className="text-xl font-bold">
                {metrics.summary?.emails_clicados ?? 0}
              </div>
            </div>
          </div>

          <h3 className="text-lg font-bold mb-4">Eventos Recientes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Documento</th>
                  <th className="px-4 py-2 text-left">Evento</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.recent_events || []).map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="px-4 py-2">
                      {new Date(event.created_at).toLocaleString("es-CL")}
                    </td>
                    <td className="px-4 py-2">{event.email}</td>
                    <td className="px-4 py-2">{event.titulo}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          event.event_type === "opened"
                            ? "bg-green-100 text-green-800"
                            : event.event_type === "clicked"
                            ? "bg-purple-100 text-purple-800"
                            : event.event_type === "bounced"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {event.event_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
