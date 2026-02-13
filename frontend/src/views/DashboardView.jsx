// src/views/DashboardView.jsx
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

export function DashboardView({ token, setView }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStats(data.documentos);
      } catch (err) {
        console.error("Error cargando stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        Cargando estadísticas...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "red" }}>
        Error cargando datos
      </div>
    );
  }

  const pieData = [
    { name: "Pendientes", value: Number(stats.pendientes) || 0, fill: "#3730a3" },
    { name: "Visados", value: Number(stats.visados) || 0, fill: "#0f766e" },
    { name: "Firmados", value: Number(stats.firmados) || 0, fill: "#166534" },
    { name: "Rechazados", value: Number(stats.rechazados) || 0, fill: "#b91c1c" },
  ];

  const barData = [
    { name: "Total", count: Number(stats.total) || 0 },
    { name: "Pendientes", count: Number(stats.pendientes) || 0 },
    { name: "Visados", count: Number(stats.visados) || 0 },
    { name: "Firmados", count: Number(stats.firmados) || 0 },
  ];

  return (
    <div style={{ padding: 40, background: "#f9fafb", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>
          📊 Dashboard
        </h1>
        <button
          className="btn-main"
          onClick={() => setView("list")}
          style={{
            background: "#e5e7eb",
            color: "#111827",
            padding: "8px 16px",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⬅️ Volver
        </button>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>
            Total Documentos
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", margin: "8px 0 0 0" }}>
            {stats.total || 0}
          </p>
        </div>

        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>
            Pendientes
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#3730a3", margin: "8px 0 0 0" }}>
            {stats.pendientes || 0}
          </p>
        </div>

        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>
            Firmados
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#166534", margin: "8px 0 0 0" }}>
            {stats.firmados || 0}
          </p>
        </div>

        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>
            Rechazados
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#b91c1c", margin: "8px 0 0 0" }}>
            {stats.rechazados || 0}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
          gap: 20,
        }}
      >
        {/* Pie Chart */}
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 20 }}>Distribución de Estados</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 20 }}>Resumen por Estado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3730a3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
