// frontend/src/views/EmailMetricsView.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/client";

function formatPercent(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "0.00%";
  return `${n.toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventBadgeClass(eventType) {
  switch (String(eventType || "").toLowerCase()) {
    case "sent":
      return "bg-blue-100 text-blue-700";
    case "delivered":
      return "bg-green-100 text-green-700";
    case "opened":
      return "bg-purple-100 text-purple-700";
    case "clicked":
      return "bg-amber-100 text-amber-700";
    case "bounced":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EmailMetricsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/analytics/email-metrics");
      const payload = res.data || {};

      setData({
        summary: payload.summary || {},
        recent_events: Array.isArray(payload.recent_events)
          ? payload.recent_events
          : [],
      });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error cargando métricas de email";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const summary = useMemo(() => data?.summary || {}, [data]);

  const recentEvents = useMemo(
    () => (Array.isArray(data?.recent_events) ? data.recent_events : []),
    [data]
  );

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-600">
        Cargando métricas de email...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <button
          onClick={fetchMetrics}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Métricas de Email</h1>
        <button
          type="button"
          onClick={fetchMetrics}
          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Resumen de envíos y eventos recientes de correos salientes.
      </p>

      {/* KPIs principales */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded bg-blue-50 p-4">
          <div className="text-sm text-gray-600">Emails Enviados</div>
          <div className="text-3xl font-bold text-blue-600">
            {Number(summary.emails_enviados ?? 0)}
          </div>
        </div>

        <div className="rounded bg-green-50 p-4">
          <div className="text-sm text-gray-600">Emails Entregados</div>
          <div className="text-3xl font-bold text-green-600">
            {Number(summary.emails_entregados ?? 0)}
          </div>
        </div>

        <div className="rounded bg-purple-50 p-4">
          <div className="text-sm text-gray-600">Tasa de Apertura</div>
          <div className="text-3xl font-bold text-purple-600">
            {formatPercent(summary.tasa_apertura)}
          </div>
        </div>

        <div className="rounded bg-amber-50 p-4">
          <div className="text-sm text-gray-600">Tasa de Click</div>
          <div className="text-3xl font-bold text-amber-600">
            {formatPercent(summary.tasa_click)}
          </div>
        </div>
      </div>

      {/* KPIs secundarios */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Emails Abiertos</div>
          <div className="text-2xl font-bold text-gray-800">
            {Number(summary.emails_abiertos ?? 0)}
          </div>
        </div>

        <div className="rounded bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Emails Clicados</div>
          <div className="text-2xl font-bold text-gray-800">
            {Number(summary.emails_clicados ?? 0)}
          </div>
        </div>

        <div className="rounded bg-red-50 p-4">
          <div className="text-sm text-gray-600">Tasa de Rebote</div>
          <div className="text-2xl font-bold text-red-600">
            {formatPercent(summary.tasa_rebote)}
          </div>
        </div>

        <div className="rounded bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Documentos Únicos</div>
          <div className="text-2xl font-bold text-gray-800">
            {Number(summary.documentos_unicos ?? 0)}
          </div>
        </div>

        <div className="rounded bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Destinatarios Únicos</div>
          <div className="text-2xl font-bold text-gray-800">
            {Number(summary.destinatarios_unicos ?? 0)}
          </div>
        </div>

        <div className="rounded bg-red-50 p-4">
          <div className="text-sm text-gray-600">Emails Rebotados</div>
          <div className="text-2xl font-bold text-red-600">
            {Number(summary.emails_reboteados ?? 0)}
          </div>
        </div>
      </div>

      {/* Tabla de eventos recientes */}
      <div className="rounded bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-bold">Eventos Recientes</h2>

        {recentEvents.length === 0 ? (
          <div className="text-sm text-gray-500">
            Aún no hay eventos de email registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Documento</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Evento</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="px-4 py-2">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      {event.title || `Documento #${event.documento_id}`}
                    </td>
                    <td className="px-4 py-2">{event.email || "-"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEventBadgeClass(
                          event.event_type
                        )}`}
                      >
                        {event.event_type || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}