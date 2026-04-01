// frontend/src/views/CompanyAnalyticsView.jsx
import { useState, useEffect, useMemo } from "react";
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
import { Bar, Pie } from "react-chartjs-2";
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

export default function CompanyAnalyticsView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/analytics/company");
      setAnalytics(res.data || null);
    } catch (err) {
      console.error("Error cargando analytics:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error cargando analytics";
      setError(msg);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const summary = analytics?.summary || {};
  const monthlyStats = Array.isArray(analytics?.monthly_stats)
    ? analytics.monthly_stats
    : [];
  const topUsers = Array.isArray(analytics?.top_users)
    ? analytics.top_users
    : [];

  const totalDocs = Number(summary.total_documentos ?? 0);

  const statusData = useMemo(
    () => ({
      labels: ["Firmados", "En Firma", "En Revisión", "Rechazados", "Borradores"],
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
            "#6b7280",
          ],
          borderWidth: 1,
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
          backgroundColor: "#3b82f6",
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    }),
    [monthlyStats]
  );

  const statusOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            font: { size: 11 },
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
        legend: {
          display: false,
        },
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
          ticks: {
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            font: { size: 11 },
          },
        },
      },
    }),
    []
  );

  const noChartData =
    !totalDocs && monthlyStats.length === 0 && topUsers.length === 0;

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Cargando analytics...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
        <button
          onClick={fetchAnalytics}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Analytics Empresarial</h1>

      {noChartData && (
        <div className="mb-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aún no hay suficientes datos para mostrar métricas avanzadas de esta empresa.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded">
          <div className="text-sm text-gray-600">Total Documentos</div>
          <div className="text-3xl font-bold text-blue-600">{totalDocs}</div>
        </div>

        <div className="bg-green-50 p-4 rounded">
          <div className="text-sm text-gray-600">Firmados</div>
          <div className="text-3xl font-bold text-green-600">
            {Number(summary.firmados ?? 0)}
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tiempo Promedio</div>
          <div className="text-3xl font-bold text-purple-600">
            {formatHours(summary.tiempo_promedio_firma_horas)}
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tasa de Rechazo</div>
          <div className="text-3xl font-bold text-red-600">
            {formatPercent(summary.tasa_rechazo)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-bold mb-4 text-sm md:text-base">
            Documentos por Estado
          </h3>
          {totalDocs === 0 ? (
            <div className="text-sm text-gray-500">
              Aún no hay documentos para graficar.
            </div>
          ) : (
            <Pie data={statusData} options={statusOptions} />
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-bold mb-4 text-sm md:text-base">
            Documentos por Mes (Últimos 6 meses)
          </h3>
          {monthlyStats.length === 0 ? (
            <div className="text-sm text-gray-500">
              Aún no hay actividad mensual disponible.
            </div>
          ) : (
            <div className="h-64">
              <Bar data={monthlyData} options={monthlyOptions} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold mb-4 text-sm md:text-base">
          Top Usuarios Más Activos
        </h3>
        {topUsers.length === 0 ? (
          <div className="text-sm text-gray-500">
            Aún no hay datos de usuarios activos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left">Usuario</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-right">Documentos Creados</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, idx) => (
                  <tr key={u.id ?? u.email ?? idx} className="border-b">
                    <td className="px-4 py-2">{u.name || "-"}</td>
                    <td className="px-4 py-2">{u.email || "-"}</td>
                    <td className="px-4 py-2 text-right font-bold">
                      {Number(u.documentos_creados || 0)}
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