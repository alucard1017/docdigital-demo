// frontend/src/views/CompanyAnalyticsView.jsx
import { useState, useEffect } from "react";
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
import axios from "axios";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CompanyAnalyticsView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_BASE_URL}/api/analytics/company`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAnalytics(res.data);
      setError(null);
    } catch (err) {
      console.error("Error cargando analytics:", err);
      setError(err.response?.data?.message || "Error cargando analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Cargando analytics...</div>;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const monthlyStats = analytics?.monthly_stats || [];
  const topUsers = analytics?.top_users || [];

  const statusData = {
    labels: ["Firmados", "En Firma", "En Revisión", "Rechazados", "Borradores"],
    datasets: [
      {
        data: [
          summary.firmados || 0,
          summary.en_firma || 0,
          summary.en_revision || 0,
          summary.rechazados || 0,
          summary.borradores || 0,
        ],
        backgroundColor: [
          "#10b981",
          "#3b82f6",
          "#f59e0b",
          "#ef4444",
          "#6b7280",
        ],
      },
    ],
  };

  const monthlyData = {
    labels: monthlyStats.map((m) => m.mes),
    datasets: [
      {
        label: "Documentos Creados",
        data: monthlyStats.map((m) => m.total),
        backgroundColor: "#3b82f6",
      },
    ],
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Analytics Empresarial</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded">
          <div className="text-sm text-gray-600">Total Documentos</div>
          <div className="text-3xl font-bold text-blue-600">
            {summary.total_documentos ?? 0}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <div className="text-sm text-gray-600">Firmados</div>
          <div className="text-3xl font-bold text-green-600">
            {summary.firmados ?? 0}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tiempo Promedio</div>
          <div className="text-3xl font-bold text-purple-600">
            {(summary.tiempo_promedio_firma_horas ?? 0) + "h"}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tasa de Rechazo</div>
          <div className="text-3xl font-bold text-red-600">
            {summary.tasa_rechazo ?? 0}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-bold mb-4">Documentos por Estado</h3>
          <Pie data={statusData} />
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-bold mb-4">
            Documentos por Mes (Últimos 6 meses)
          </h3>
          <Bar data={monthlyData} />
        </div>
      </div>

      {/* Top usuarios */}
      <div className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold mb-4">Top Usuarios Más Activos</h3>
        {topUsers.length === 0 ? (
          <div className="text-sm text-gray-500">
            Aún no hay datos de usuarios activos.
          </div>
        ) : (
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
                <tr key={idx} className="border-b">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 text-right font-bold">
                    {u.documentos_creados}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
