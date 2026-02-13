// src/views/DashboardView.jsx
import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Dashboard de VeriFirma.
 * Recibe la lista completa de docs desde App.jsx.
 */
export function DashboardView({ docs, user }) {
  const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#ef4444", "#0ea5e9", "#a855f7"];

  // KPIs base
  const kpis = useMemo(() => {
    const total = docs.length;
    const pendientes = docs.filter(
      (d) =>
        d.status === "PENDIENTE" ||
        d.status === "PENDIENTE_VISADO" ||
        d.status === "PENDIENTE_FIRMA"
    ).length;
    const firmados = docs.filter((d) => d.status === "FIRMADO").length;
    const rechazados = docs.filter((d) => d.status === "RECHAZADO").length;

    return { total, pendientes, firmados, rechazados };
  }, [docs]);

  // Documentos por status (agrupando pendientes)
  const statusData = useMemo(() => {
    let pendientesCount = 0;
    const other = {};

    docs.forEach((d) => {
      const s = d.status || "SIN_ESTADO";
      if (
        s === "PENDIENTE" ||
        s === "PENDIENTE_FIRMA" ||
        s === "PENDIENTE_VISADO"
      ) {
        pendientesCount += 1;
      } else {
        other[s] = (other[s] || 0) + 1;
      }
    });

    const result = [];

    if (pendientesCount > 0) {
      result.push({ status: "PENDIENTES", count: pendientesCount });
    }

    Object.entries(other).forEach(([status, count]) => {
      result.push({ status, count });
    });

    const order = ["PENDIENTES", "VISADO", "FIRMADO", "RECHAZADO"];
    result.sort((a, b) => {
      const ia = order.indexOf(a.status);
      const ib = order.indexOf(b.status);
      if (ia === -1 && ib === -1) return a.status.localeCompare(b.status);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return result;
  }, [docs]);

  // Documentos creados por día (created_at)
  const perDayData = useMemo(() => {
    const byDate = {};
    docs.forEach((d) => {
      if (!d.created_at) return;
      const date = new Date(d.created_at);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      byDate[key] = (byDate[key] || 0) + 1;
    });
    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [docs]);

  // Por tipo_tramite
  const tipoTramiteData = useMemo(() => {
    const counts = {};
    docs.forEach((d) => {
      const key = d.tipo_tramite || "SIN_TIPO";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [docs]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>📊 Dashboard</h1>
        <p style={{ marginTop: 4, fontSize: "0.9rem", color: "#64748b" }}>
          Hola {user?.name || "usuario"}, aquí ves un resumen visual de tus trámites recientes.
        </p>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <KpiCard
          label="Total documentos"
          value={kpis.total}
          color="#0f172a"
          bg="rgba(15, 23, 42, 0.04)"
        />
        <KpiCard
          label="Pendientes"
          value={kpis.pendientes}
          color="#f97316"
          bg="rgba(249, 115, 22, 0.08)"
        />
        <KpiCard
          label="Firmados"
          value={kpis.firmados}
          color="#22c55e"
          bg="rgba(34, 197, 94, 0.08)"
        />
        <KpiCard
          label="Rechazados"
          value={kpis.rechazados}
          color="#ef4444"
          bg="rgba(239, 68, 68, 0.08)"
        />
      </div>

      {/* Fila 1: barras por estado + línea por día */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <ChartCard
          title="Documentos por estado"
          description="Distribución según el estado actual del trámite."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Cantidad" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Documentos creados por día"
          description="Actividad según fecha de creación (últimos movimientos)."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={perDayData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                name="Documentos"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Fila 2: pie por tipo_tramite + panel lateral */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          gap: 24,
        }}
      >
        <ChartCard
          title="Tipos de trámite"
          description="Proporción de documentos según el tipo de trámite."
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={tipoTramiteData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {tipoTramiteData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: 16,
            background:
              "radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.1), transparent 55%), radial-gradient(circle at 100% 100%, rgba(129, 140, 248, 0.12), transparent 55%)",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: "1rem",
              color: "#0f172a",
            }}
          >
            Siguiente paso sugerido
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: 8 }}>
            Usa este panel para detectar cuellos de botella: muchos{" "}
            <strong>PENDIENTE_VISADO</strong> o <strong>PENDIENTE_FIRMA</strong> indican trámites
            detenidos antes de la firma final.
          </p>
          <p style={{ fontSize: "0.85rem", color: "#475569" }}>
            Si ves poca creación en los últimos días, prueba un flujo completo
            con un cliente real para validar la experiencia de punta a punta.
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, bg }) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        minWidth: 160,
        padding: 14,
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: bg || "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: "1.4rem", fontWeight: 700, color: color || "#0f172a" }}>
        {value}
      </span>
    </div>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: 16,
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 260,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            marginBottom: 4,
            fontSize: "0.95rem",
            color: "#0f172a",
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 180 }}>{children}</div>
    </div>
  );
}
