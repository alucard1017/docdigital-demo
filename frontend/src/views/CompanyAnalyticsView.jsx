import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import api from "../api/client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function formatHours(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.0h";
  return `${n.toFixed(1)}h`;
}

function formatPercent(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

function formatNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("es-CL").format(n);
}

function ExecutiveCard({ label, value, tone = "slate", hint }) {
  const tones = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    green: "border-emerald-200 bg-emerald-50",
    purple: "border-violet-200 bg-violet-50",
    red: "border-rose-200 bg-rose-50",
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

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function buildSummary(summary) {
  const total = Number(summary?.total_documentos ?? 0);
  const firmados = Number(summary?.firmados ?? 0);
  const rechazo = Number(summary?.tasa_rechazo ?? 0);

  if (total === 0) {
    return "Todavía no hay volumen suficiente para evaluar comportamiento de firma a nivel empresa.";
  }

  if (rechazo >= 10) {
    return "La tasa de rechazo merece atención. Revisa claridad del documento, orden de participantes y pasos previos al envío.";
  }

  if (firmados / Math.max(total, 1) >= 0.6) {
    return "La empresa muestra una conversión saludable hacia firma. El siguiente nivel es reducir tiempos promedio y detectar usuarios con más carga.";
  }

  return "La actividad está en fase intermedia. Conviene vigilar distribución por estado y comportamiento mensual para validar estabilidad del flujo.";
}

export default function CompanyAnalyticsView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/analytics/company");
      setAnalytics(res.data || null);
    } catch (err) {
      console.error("Error cargando analytics:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Error cargando analytics";
      setError(msg);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = analytics?.summary || {};
  const monthlyStats = Array.isArray(analytics?.monthly_stats)
    ? analytics.monthly_stats
    : [];
  const topUsers = Array.isArray(analytics?.top_users)
    ? analytics.top_users
    : [];

  const totalDocs = Number(summary.total_documentos ?? 0);
  const summaryText = useMemo(() => buildSummary(summary), [summary]);

  const statusData = useMemo(
    () => ({
      labels: ["Firmados", "En firma", "En revisión", "Rechazados", "Borradores"],
      datasets: [
        {
          label: "Documentos",
          data: [
            Number(summary.firmados || 0),
            Number(summary.en_firma || 0),
            Number(summary.en_revision || 0),
            Number(summary.rechazados || 0),
            Number(summary.borradores || 0),
          ],
          backgroundColor: [
            "#10b981",
            "#3b82f6",
            "#f59e0b",
            "#ef4444",
            "#94a3b8",
          ],
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    }),
    [summary]
  );

  const monthlyData = useMemo(
    () => ({
      labels: monthlyStats.map((m) => m.mes),
      datasets: [
        {
          label: "Documentos creados",
          data: monthlyStats.map((m) => Number(m.total || 0)),
          backgroundColor: "#2563eb",
          borderRadius: 10,
          maxBarThickness: 42,
        },
      ],
    }),
    [monthlyStats]
  );

  const statusOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "56%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            color: "#64748b",
            padding: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed || 0;
              return `${ctx.label}: ${value} doc${value === 1 ? "" : "s"}`;
            },
          },
        },
      },
    }),
    []
  );

  const monthlyOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed.y || 0;
              return `${value} documento${value === 1 ? "" : "s"}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#64748b", font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: "#64748b",
            font: { size: 11 },
          },
          grid: { color: "rgba(148,163,184,0.14)" },
          border: { display: false },
        },
      },
    }),
    []
  );

  const noChartData =
    !totalDocs && monthlyStats.length === 0 && topUsers.length === 0;

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
            No pudimos cargar los analytics empresariales
          </h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Analytics empresarial
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Rendimiento de la empresa
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Vista agregada del volumen, la conversión y el comportamiento de uso
              en tu operación documental.
            </p>
          </div>

          <button
            onClick={fetchAnalytics}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Actualizar
          </button>
        </header>

        {noChartData ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
            Aún no hay suficientes datos para mostrar métricas avanzadas de esta empresa.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ExecutiveCard
            label="Total documentos"
            value={formatNumber(totalDocs)}
            tone="blue"
            hint="Volumen general de documentos en la empresa."
          />
          <ExecutiveCard
            label="Firmados"
            value={formatNumber(summary.firmados ?? 0)}
            tone="green"
            hint="Documentos completados exitosamente."
          />
          <ExecutiveCard
            label="Tiempo promedio"
            value={formatHours(summary.tiempo_promedio_firma_horas)}
            tone="purple"
            hint="Tiempo medio estimado hasta la firma."
          />
          <ExecutiveCard
            label="Tasa de rechazo"
            value={formatPercent(summary.tasa_rechazo)}
            tone="red"
            hint="Proporción de casos rechazados sobre el total."
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-500">
            Lectura ejecutiva
          </div>
          <p className="max-w-4xl text-sm leading-7 text-slate-700">
            {summaryText}
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Distribución por estado"
            description="Permite entender en qué tramo del flujo se concentra la operación."
          >
            {totalDocs === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-slate-500">
                Aún no hay documentos para graficar.
              </div>
            ) : (
              <div className="h-72">
                <Doughnut data={statusData} options={statusOptions} />
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Actividad mensual"
            description="Volumen de creación en los últimos meses para detectar crecimiento o estacionalidad."
          >
            {monthlyStats.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-slate-500">
                Aún no hay actividad mensual disponible.
              </div>
            ) : (
              <div className="h-72">
                <Bar data={monthlyData} options={monthlyOptions} />
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Usuarios más activos"
          description="Identifica quiénes están generando mayor volumen dentro de la empresa."
        >
          {topUsers.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aún no hay datos de usuarios activos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Documentos creados
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u, idx) => (
                    <tr
                      key={u.id ?? u.email ?? idx}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {u.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatNumber(u.documentos_creados || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}