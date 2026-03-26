// src/views/DashboardView.jsx
import React, { useEffect, useState } from "react";
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
import api from "../api/client";

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#ef4444", "#0ea5e9", "#a855f7"];

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

  const rawName = user?.name || user?.fullName || "Usuario";
  const isJean =
    user &&
    (user.email === "tu-correo@loqueuses.com" || user.name === "Jean");
  const displayName = isJean ? "Alucard" : rawName;

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/docs/stats");
        const data = res.data || {};

        setKpis({
          total: data.kpis?.total ?? 0,
          pendientes: data.kpis?.pendientes ?? 0,
          firmados: data.kpis?.firmados ?? 0,
          rechazados: data.kpis?.rechazados ?? 0,
        });

        const status = [];
        if (data.kpis?.pendientes) {
          status.push({ status: "PENDIENTES", count: data.kpis.pendientes });
        }
        if (data.kpis?.firmados) {
          status.push({ status: "FIRMADO", count: data.kpis.firmados });
        }
        if (data.kpis?.rechazados) {
          status.push({ status: "RECHAZADO", count: data.kpis.rechazados });
        }
        status.sort((a, b) => {
          const order = ["PENDIENTES", "FIRMADO", "RECHAZADO"];
          return order.indexOf(a.status) - order.indexOf(b.status);
        });
        setStatusData(status);

        setPerDayData(
          (data.perDay || []).map((d) => ({
            date: d.date,
            count: Number(d.count || 0),
          }))
        );

        setTipoTramiteData(
          (data.porTipoTramite || []).map((t) => ({
            name: t.tipo_tramite || "Sin tipo",
            value: Number(t.count || 0),
          }))
        );
      } catch (err) {
        console.error("Error cargando stats:", err);
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Error al cargar estadísticas";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "#e5e7eb",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "1.6rem",
            color: "#e5e7eb",
            letterSpacing: "-0.02em",
          }}
        >
          📊 Dashboard de actividad
        </h1>
        <p
          style={{
            marginTop: 4,
            fontSize: "0.9rem",
            color: "#9ca3af",
          }}
        >
          Hola <strong>{displayName}</strong>, aquí ves un resumen visual de tus
          trámites recientes y su estado.
        </p>
      </div>

      {loading ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          Cargando estadísticas…
        </div>
      ) : error ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#fecaca",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : (
        <>
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
              color="#e5e7eb"
              bg="rgba(15, 23, 42, 0.8)"
            />
            <KpiCard
              label="Pendientes"
              value={kpis.pendientes}
              color="#fed7aa"
              bg="rgba(249, 115, 22, 0.22)"
            />
            <KpiCard
              label="Firmados"
              value={kpis.firmados}
              color="#bbf7d0"
              bg="rgba(34, 197, 94, 0.22)"
            />
            <KpiCard
              label="Rechazados"
              value={kpis.rechazados}
              color="#fecaca"
              bg="rgba(239, 68, 68, 0.22)"
            />
          </div>

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
                <BarChart
                  data={statusData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      color: "#e5e7eb",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                  />
                  <Bar
                    dataKey="count"
                    name="Cantidad"
                    fill="#4f46e5"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Documentos creados por día"
              description="Actividad según fecha de creación (últimos movimientos)."
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={perDayData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      color: "#e5e7eb",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                  />
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      color: "#e5e7eb",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                  />
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
                border: "1px solid #1f2937",
                padding: 16,
                background:
                  "radial-gradient(circle at 0 0, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(129,140,248,0.22), transparent 55%)",
                backgroundColor: "#020617",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 8,
                  fontSize: "1rem",
                  color: "#e5e7eb",
                }}
              >
                Siguiente paso sugerido
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#cbd5f5",
                  marginBottom: 8,
                }}
              >
                Usa este panel para detectar cuellos de botella: muchos{" "}
                <strong>PENDIENTE_VISADO</strong> o{" "}
                <strong>PENDIENTE_FIRMA</strong> indican trámites detenidos
                antes de la firma final.
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#9ca3af",
                }}
              >
                Si ves poca creación en los últimos días, prueba un flujo
                completo con un cliente real para validar la experiencia de
                punta a punta.
              </p>
            </div>
          </div>
        </>
      )}
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
        border: "1px solid #1f2937",
        background: bg || "#020617",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: "0.8rem",
          color: "#9ca3af",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: color || "#e5e7eb",
        }}
      >
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
        border: "1px solid #1f2937",
        padding: 16,
        backgroundColor: "#020617",
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
            color: "#e5e7eb",
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "#9ca3af",
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