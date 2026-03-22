// frontend/src/views/CompanyAnalyticsView.jsx
import { useState, useEffect } from "react";
import axios from "axios";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

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
      const res = await axios.get("/api/analytics/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(res.data);
      setError(null);
    } catch (err) {
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

  const statusData = {
    labels: ["Firmados", "En Firma", "En Revisión", "Rechazados", "Borradores"],
    datasets: [
      {
        data: [
          analytics.summary.firmados,
          analytics.summary.en_firma,
          analytics.summary.en_revision,
          analytics.summary.rechazados,
          analytics.summary.borradores,
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
    labels: analytics.monthly_stats.map((m) => m.mes),
    datasets: [
      {
        label: "Documentos Creados",
        data: analytics.monthly_stats.map((m) => m.total),
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
            {analytics.summary.total_documentos}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <div className="text-sm text-gray-600">Firmados</div>
          <div className="text-3xl font-bold text-green-600">
            {analytics.summary.firmados}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tiempo Promedio</div>
          <div className="text-3xl font-bold text-purple-600">
            {analytics.summary.tiempo_promedio_firma_horas}h
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <div className="text-sm text-gray-600">Tasa de Rechazo</div>
          <div className="text-3xl font-bold text-red-600">
            {analytics.summary.tasa_rechazo}
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
          <h3 className="font-bold mb-4">Documentos por Mes (Últimos 6 meses)</h3>
          <Bar data={monthlyData} />
        </div>
      </div>

      {/* Top usuarios */}
      <div className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold mb-4">Top Usuarios Más Activos</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-4 py-2 text-left">Usuario</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-right">Documentos Creados</th>
            </tr>
          </thead>
          <tbody>
            {analytics.top_users.map((u, idx) => (
              <tr key={idx} className="border-b">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2 text-right font-bold">{u.documentos_creados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
