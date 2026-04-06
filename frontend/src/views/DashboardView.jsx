import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import api from "../api/client";

ChartJS.register(
  BarElement,
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

const COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const SAFE_COLORS =
  Array.isArray(COLORS) && COLORS.length > 0 ? COLORS : ["#475569"];

function formatNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("es-CL").format(n);
}

function buildInsight(kpis) {
  const pendientes = Number(kpis?.pendientes ?? 0);
  const firmados = Number(kpis?.firmados ?? 0);
  const rechazados = Number(kpis?.rechazados ?? 0);
  const total = Number(kpis?.total ?? 0);

  if (total === 0) {
    return "Aún no hay actividad suficiente para detectar patrones. Cuando empieces a crear trámites, aquí verás señales de volumen, avance y fricción.";
  }

  if (pendientes >= firmados && pendientes > 0) {
    return "Tu mayor volumen está en documentos pendientes. Este es el mejor lugar para revisar cuellos de botella antes de que impacten la conversión a firma.";
  }

  if (rechazados > 0 && rechazados / Math.max(total, 1) >= 0.15) {
    return "La tasa de rechazo empieza a ser relevante. Conviene revisar plantillas, instrucciones al firmante y validación previa del flujo.";
  }

  if (firmados > 0 && firmados / Math.max(total, 1) >= 0.6) {
    return "El panel muestra un buen nivel de avance a firma. Puedes enfocarte ahora en reducir tiempos de ciclo y mejorar seguimiento de pendientes.";
  }

  return "La operación se ve estable. Úsalo para confirmar tendencia diaria y detectar si algún tipo de trámite se está acumulando más que el resto.";
}

function EmptyPanel({ title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17v-4" />
          <path d="M8 17v-7" />
        </svg>
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
}

function KpiCard({ label, value, tone = "slate", helper }) {
  const toneMap = {
    slate: "bg-white border-slate-200 text-slate-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
    red: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneMap[tone] || toneMap.slate}`}>
      <div className="mb-2 text-sm font-medium text-slate-500">{label}</div>
      <div className="text-3xl font-semibold tracking-tight">{formatNumber(value)}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function ChartCard({ title, description, children, actions = null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DashboardView({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kpis, setKpis] = useState({
    total: 0,
    pendientes: 0,
    firmados: 0,
    rechazados: 0,
  });
  const [statusData, setStatusData] = useState([]);
  const [perDayData, setPerDayData] = useState([]);
  const [tipoTramiteData, setTipoTramiteData] = useState([]);

  const displayName = user?.name || user?.fullName || "Usuario";

  const fetchStats = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/docs/stats", { signal });
      const data = res?.data || {};
      const safeKpis = data?.kpis || {};

      const nextKpis = {
        total: Number(safeKpis.total ?? 0),
        pendientes: Number(safeKpis.pendientes ?? 0),
        firmados: Number(safeKpis.firmados ?? 0),
        rechazados: Number(safeKpis.rechazados ?? 0),
      };

      setKpis(nextKpis);

      const nextStatus = [
        { status: "Pendientes", count: nextKpis.pendientes },
        { status: "Firmados", count: nextKpis.firmados },
        { status: "Rechazados", count: nextKpis.rechazados },
      ].filter((item) => item.count > 0);

      setStatusData(nextStatus);

      setPerDayData(
        Array.isArray(data?.perDay)
          ? data.perDay.map((d) => ({
              date: d?.date || "",
              count: Number(d?.count || 0),
            }))
          : []
      );

      setTipoTramiteData(
        Array.isArray(data?.porTipoTramite)
          ? data.porTipoTramite.map((t) => ({
              name: t?.tipo_tramite || "Sin tipo",
              value: Number(t?.count || 0),
            }))
          : []
      );
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;

      console.error("Error cargando stats:", err);

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Error al cargar estadísticas";

      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  const hasAnyData = useMemo(() => {
    return (
      Number(kpis.total) > 0 ||
      statusData.length > 0 ||
      perDayData.length > 0 ||
      tipoTramiteData.length > 0
    );
  }, [kpis.total, statusData, perDayData, tipoTramiteData]);

  const insight = useMemo(() => buildInsight(kpis), [kpis]);

  const baseChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          labels: {
            color: "#475569",
            font: { size: 12 },
            boxWidth: 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#cbd5e1",
          borderWidth: 1,
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: "#64748b", font: { size: 11 } },
          grid: { color: "rgba(148,163,184,0.12)", drawBorder: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            precision: 0,
          },
          grid: { color: "rgba(148,163,184,0.12)", drawBorder: false },
          border: { display: false },
        },
      },
    }),
    []
  );

  const statusChartData = useMemo(
    () => ({
      labels: statusData.map((item) => item.status),
      datasets: [
        {
          label: "Cantidad",
          data: statusData.map((item) => item.count),
          backgroundColor: ["#f59e0b", "#10b981", "#ef4444"],
          borderRadius: 10,
          maxBarThickness: 56,
        },
      ],
    }),
    [statusData]
  );

  const perDayChartData = useMemo(
    () => ({
      labels: perDayData.map((item) => item.date),
      datasets: [
        {
          label: "Documentos",
          data: perDayData.map((item) => item.count),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#2563eb",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
        },
      ],
    }),
    [perDayData]
  );

  const tipoTramiteChartData = useMemo(
    () => ({
      labels: tipoTramiteData.map((item) => item.name),
      datasets: [
        {
          label: "Cantidad",
          data: tipoTramiteData.map((item) => item.value),
          backgroundColor: tipoTramiteData.map(
            (_, index) => SAFE_COLORS[index % SAFE_COLORS.length]
          ),
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [tipoTramiteData]
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#64748b",
            font: { size: 12 },
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#cbd5e1",
          borderWidth: 1,
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
        },
      },
    }),
    []
  );

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Panel ejecutivo
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Dashboard de actividad
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Hola {displayName}, aquí tienes un resumen claro del volumen,
              avance y estado de tus trámites recientes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchStats()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Actualizar panel
          </button>
        </header>

        {loading ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </div>
          </>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">
              No pudimos cargar el dashboard
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => fetchStats()}
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              Reintentar
            </button>
          </div>
        ) : !hasAnyData ? (
          <EmptyPanel
            title="Aún no hay métricas para mostrar"
            description="Cuando empieces a crear y mover documentos, aquí verás distribución por estado, tendencia diaria y composición por tipo de trámite."
          />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Total documentos"
                value={kpis.total}
                tone="slate"
                helper="Volumen total registrado en el periodo disponible."
              />
              <KpiCard
                label="Pendientes"
                value={kpis.pendientes}
                tone="amber"
                helper="Documentos que aún requieren acción para avanzar."
              />
              <KpiCard
                label="Firmados"
                value={kpis.firmados}
                tone="green"
                helper="Trámites completados con firma exitosa."
              />
              <KpiCard
                label="Rechazados"
                value={kpis.rechazados}
                tone="red"
                helper="Casos que requieren revisión de flujo o contenido."
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 text-sm font-medium text-slate-500">
                Lectura rápida
              </div>
              <p className="max-w-4xl text-sm leading-7 text-slate-700">
                {insight}
              </p>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ChartCard
                title="Documentos por estado"
                description="Distribución actual para detectar carga operativa y avance hacia firma."
              >
                {statusData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                    No hay datos de estado suficientes para graficar.
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <Bar data={statusChartData} options={baseChartOptions} />
                  </div>
                )}
              </ChartCard>

              <ChartCard
                title="Actividad por día"
                description="Tendencia reciente de creación de documentos para ver ritmo operativo."
              >
                {perDayData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                    Aún no hay actividad diaria suficiente.
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <Line data={perDayChartData} options={baseChartOptions} />
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <ChartCard
                title="Tipos de trámite"
                description="Participación relativa por categoría para entender la mezcla operativa."
              >
                {tipoTramiteData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                    No hay tipos de trámite suficientes para mostrar proporciones.
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <Doughnut data={tipoTramiteChartData} options={doughnutOptions} />
                  </div>
                )}
              </ChartCard>

              <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-sm">
                <div className="mb-2 inline-flex rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-300">
                  Recomendación
                </div>
                <h2 className="text-base font-semibold text-white">
                  Siguiente foco operativo
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Si los pendientes crecen más rápido que los firmados, conviene
                  revisar recordatorios, tiempos entre pasos y fricción en el
                  enlace público.
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Si la creación diaria cae, prueba el flujo completo como usuario
                  real para validar envío, apertura, firma y verificación de punta a punta.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardView;