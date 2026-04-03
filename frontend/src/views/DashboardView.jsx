// frontend/src/views/DashboardView.jsx
import React, { useEffect, useMemo, useState } from "react";
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

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#ef4444", "#0ea5e9", "#a855f7"];
const SAFE_COLORS =
  Array.isArray(COLORS) && COLORS.length > 0 ? COLORS : ["#4b5563"];

const CHART_TEXT = "#cbd5e1";
const CHART_MUTED = "#94a3b8";
const CHART_GRID = "rgba(148, 163, 184, 0.14)";
const CHART_BORDER = "#1f2937";
const CHART_BG = "#020617";

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
    const controller = new AbortController();

    async function fetchStats() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/docs/stats", {
          signal: controller.signal,
        });

        const data = res?.data || {};
        const safeKpis = data?.kpis || {};

        setKpis({
          total: Number(safeKpis.total ?? 0),
          pendientes: Number(safeKpis.pendientes ?? 0),
          firmados: Number(safeKpis.firmados ?? 0),
          rechazados: Number(safeKpis.rechazados ?? 0),
        });

        const nextStatus = [];
        if (Number(safeKpis.pendientes ?? 0) > 0) {
          nextStatus.push({ status: "Pendientes", count: Number(safeKpis.pendientes) });
        }
        if (Number(safeKpis.firmados ?? 0) > 0) {
          nextStatus.push({ status: "Firmados", count: Number(safeKpis.firmados) });
        }
        if (Number(safeKpis.rechazados ?? 0) > 0) {
          nextStatus.push({ status: "Rechazados", count: Number(safeKpis.rechazados) });
        }

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
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }

        console.error("Error cargando stats:", err);

        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al cargar estadísticas";

        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();

    return () => controller.abort();
  }, []);

  const baseChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 350,
      },
      plugins: {
        legend: {
          labels: {
            color: CHART_MUTED,
            font: {
              size: 12,
            },
            boxWidth: 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: CHART_BORDER,
          borderWidth: 1,
          titleColor: "#e5e7eb",
          bodyColor: "#cbd5e1",
          padding: 10,
          displayColors: true,
        },
      },
      scales: {
        x: {
          ticks: {
            color: CHART_MUTED,
            font: { size: 11 },
          },
          grid: {
            color: CHART_GRID,
            drawBorder: false,
          },
          border: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: CHART_MUTED,
            font: { size: 11 },
            precision: 0,
          },
          grid: {
            color: CHART_GRID,
            drawBorder: false,
          },
          border: {
            display: false,
          },
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
          backgroundColor: ["#4f46e5", "#22c55e", "#ef4444"],
          borderRadius: 8,
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
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#38bdf8",
          pointBorderColor: "#0ea5e9",
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
          borderColor: CHART_BG,
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
      cutout: "52%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: CHART_MUTED,
            font: { size: 12 },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: CHART_BORDER,
          borderWidth: 1,
          titleColor: "#e5e7eb",
          bodyColor: "#cbd5e1",
          padding: 10,
        },
      },
    }),
    []
  );

  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "#e5e7eb",
        minHeight: "100%",
        background:
          "radial-gradient(circle at top, #020617 0, #020617 45%, #0b1120 100%)",
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
          Dashboard de actividad
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
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            <ChartCard
              title="Documentos por estado"
              description="Distribución según el estado actual del trámite."
            >
              <div style={{ height: 260 }}>
                <Bar data={statusChartData} options={baseChartOptions} />
              </div>
            </ChartCard>

            <ChartCard
              title="Documentos creados por día"
              description="Actividad según fecha de creación en los últimos movimientos."
            >
              <div style={{ height: 260 }}>
                <Line data={perDayChartData} options={baseChartOptions} />
              </div>
            </ChartCard>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
              gap: 24,
            }}
          >
            <ChartCard
              title="Tipos de trámite"
              description="Proporción de documentos según el tipo de trámite."
            >
              <div style={{ height: 260 }}>
                <Doughnut data={tipoTramiteChartData} options={doughnutOptions} />
              </div>
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
                  lineHeight: 1.6,
                }}
              >
                Usa este panel para detectar cuellos de botella. Si aumentan los
                documentos pendientes, probablemente tienes trámites detenidos antes
                de la firma final.
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#9ca3af",
                  lineHeight: 1.6,
                }}
              >
                Si ves poca creación en los últimos días, prueba un flujo completo
                con un cliente real para validar la experiencia de punta a punta.
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
              lineHeight: 1.5,
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

export default DashboardView;