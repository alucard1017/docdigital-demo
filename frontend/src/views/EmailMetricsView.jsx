import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/client";

function formatPercent(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00%";
  return `${n.toFixed(2)}%`;
}

function formatNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("es-CL").format(n);
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
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "opened":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "clicked":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "bounced":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function MetricCard({ label, value, hint, tone = "slate" }) {
  const tones = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-emerald-50 border-emerald-200",
    purple: "bg-violet-50 border-violet-200",
    amber: "bg-amber-50 border-amber-200",
    red: "bg-rose-50 border-rose-200",
    slate: "bg-white border-slate-200",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function buildEmailInsight(summary) {
  const apertura = Number(summary?.tasa_apertura ?? 0);
  const click = Number(summary?.tasa_click ?? 0);
  const rebote = Number(summary?.tasa_rebote ?? 0);
  const enviados = Number(summary?.emails_enviados ?? 0);

  if (enviados === 0) {
    return "Aún no hay suficiente volumen de correos para evaluar desempeño de entrega y engagement.";
  }

  if (rebote >= 5) {
    return "La tasa de rebote está alta. Conviene revisar calidad de base de destinatarios, dominios y validación previa del email.";
  }

  if (apertura > 0 && click === 0) {
    return "Los correos se abren, pero casi no generan interacción. Revisa claridad del CTA y el contenido del mensaje.";
  }

  if (apertura >= 35 && click >= 8) {
    return "El rendimiento de email se ve saludable. La siguiente optimización debería centrarse en acelerar la conversión desde apertura hasta acción.";
  }

  return "El desempeño es estable. Úsalo para detectar si el problema principal está en entrega, apertura o click.";
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
      console.error("Error cargando métricas de email:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
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

  const noData =
    Number(summary.emails_enviados ?? 0) === 0 && recentEvents.length === 0;

  const insight = useMemo(() => buildEmailInsight(summary), [summary]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-rose-900">
            No pudimos cargar las métricas de email
          </h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Email analytics
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Métricas de email
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Resumen de entregabilidad, engagement y eventos recientes de tus correos salientes.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchMetrics}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Actualizar
          </button>
        </header>

        {noData ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
            Aún no hay suficiente actividad de correos para mostrar métricas útiles.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Emails enviados"
            value={formatNumber(summary.emails_enviados ?? 0)}
            tone="blue"
            hint="Volumen total procesado por el sistema."
          />
          <MetricCard
            label="Emails entregados"
            value={formatNumber(summary.emails_entregados ?? 0)}
            tone="green"
            hint="Correos aceptados por el destinatario o servidor destino."
          />
          <MetricCard
            label="Tasa de apertura"
            value={formatPercent(summary.tasa_apertura)}
            tone="purple"
            hint="Porcentaje de correos abiertos respecto del universo entregado."
          />
          <MetricCard
            label="Tasa de click"
            value={formatPercent(summary.tasa_click)}
            tone="amber"
            hint="Interacción efectiva sobre los mensajes enviados."
          />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Emails abiertos"
            value={formatNumber(summary.emails_abiertos ?? 0)}
            tone="slate"
          />
          <MetricCard
            label="Emails clicados"
            value={formatNumber(summary.emails_clicados ?? 0)}
            tone="slate"
          />
          <MetricCard
            label="Tasa de rebote"
            value={formatPercent(summary.tasa_rebote)}
            tone="red"
          />
          <MetricCard
            label="Documentos únicos"
            value={formatNumber(summary.documentos_unicos ?? 0)}
            tone="slate"
          />
          <MetricCard
            label="Destinatarios únicos"
            value={formatNumber(summary.destinatarios_unicos ?? 0)}
            tone="slate"
          />
          <MetricCard
            label="Emails rebotados"
            value={formatNumber(summary.emails_reboteados ?? 0)}
            tone="red"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-500">
            Lectura rápida
          </div>
          <p className="max-w-4xl text-sm leading-7 text-slate-700">{insight}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-950">
              Eventos recientes
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Últimos eventos registrados de envío, entrega, apertura, click o rebote.
            </p>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aún no hay eventos de email registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Documento</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Evento</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {event.title || `Documento #${event.documento_id}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {event.email || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getEventBadgeClass(
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
        </section>
      </div>
    </div>
  );
}