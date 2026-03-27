// src/views/StatusAdminView.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

const badgeColor = (status) => {
  if (!status) return "#6b7280";
  const v = String(status).toLowerCase();
  if (v === "ok" || v === "healthy" || v === "up") return "#16a34a";
  if (v === "degraded") return "#ea580c";
  if (v === "down" || v === "error") return "#b91c1c";
  return "#6b7280";
};

export function StatusAdminView() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchAll() {
    try {
      setLoading(true);
      setError("");

      const [healthRes, metricsRes] = await Promise.all([
        api.get("/health"),
        api.get("/status/metrics"),
      ]);

      setHealth(healthRes.data || null);
      setMetrics(metricsRes.data || null);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error interno obteniendo métricas";
      setError(msg);
      setHealth(null);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const cardBorder = "#1f2937";
  const subtleText = "#94a3b8";
  const strongText = "#e5e7eb";

  // helpers seguros para arrays
  const docActions = Array.isArray(metrics?.documents?.actions_last_60m)
    ? metrics.documents.actions_last_60m
    : [];
  const hasDocActivity = docActions.length > 0;

  return (
    <div
      className="status-admin-view"
      style={{
        minHeight: "100%",
        padding: 24,
        background:
          "radial-gradient(circle at top, #020617 0, #020617 45%, #0b1120 100%)",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.4rem",
                margin: 0,
                marginBottom: 4,
                letterSpacing: "0.02em",
              }}
            >
              Estado del sistema
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                color: subtleText,
                maxWidth: 560,
              }}
            >
              Monitorea la salud de la API, la base de datos y la actividad
              reciente para detectar problemas antes que tus usuarios.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn-main btn-primary"
              onClick={fetchAll}
              disabled={loading}
              style={{
                minWidth: 120,
                paddingInline: 14,
              }}
            >
              {loading ? "Actualizando..." : "Refrescar"}
            </button>

            <button
              type="button"
              className="btn-main"
              style={{
                background: "transparent",
                border: "1px dashed #475569",
                color: "#e5e7eb",
                fontSize: "0.85rem",
              }}
              onClick={() => {
                throw new Error("Test manual de Sentry desde StatusAdminView");
              }}
            >
              Probar error Sentry
            </button>
          </div>
        </header>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #7f1d1d",
              background:
                "linear-gradient(135deg, rgba(185,28,28,0.12), rgba(15,23,42,0.7))",
              color: "#fecaca",
              fontSize: "0.85rem",
            }}
          >
            <strong style={{ fontWeight: 600 }}>Error:</strong> {error}
          </div>
        )}

        <div
          className="status-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {health && (
            <div
              className="card"
              style={{
                padding: 18,
                borderRadius: 16,
                border: `1px solid ${cardBorder}`,
                background:
                  "radial-gradient(circle at top left, rgba(56,189,248,0.08), transparent 55%)",
                boxShadow: "0 20px 45px rgba(15,23,42,0.55)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: subtleText,
                  }}
                >
                  API & Infra
                </h3>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 10px",
                    borderRadius: 999,
                    backgroundColor: "rgba(15,23,42,0.9)",
                    border: "1px solid #1e293b",
                    fontSize: "0.75rem",
                    color: strongText,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "999px",
                      backgroundColor: badgeColor(health.status),
                      boxShadow: "0 0 0 4px rgba(34,197,94,0.18)",
                    }}
                  />
                  {health.status || "Unknown"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 6,
                  fontSize: "0.86rem",
                }}
              >
                <div>
                  <div style={{ color: subtleText }}>Uptime</div>
                  <div style={{ fontWeight: 500, color: strongText }}>
                    {health.uptime_seconds}s
                  </div>
                </div>
                <div>
                  <div style={{ color: subtleText }}>Hora servidor</div>
                  <div style={{ fontWeight: 500, color: strongText }}>
                    {health.timestamp
                      ? new Date(health.timestamp).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <div style={{ color: subtleText }}>Base de datos</div>
                  <div style={{ fontWeight: 500, color: strongText }}>
                    {health.checks?.database || "N/A"}
                  </div>
                </div>
                <div>
                  <div style={{ color: subtleText }}>Storage</div>
                  <div style={{ fontWeight: 500, color: strongText }}>
                    {health.checks?.storage || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {metrics && (
            <>
              <div
                className="card"
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: `1px solid ${cardBorder}`,
                  background:
                    "radial-gradient(circle at top left, rgba(59,130,246,0.1), transparent 60%)",
                  boxShadow: "0 20px 45px rgba(15,23,42,0.55)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: subtleText,
                  }}
                >
                  Autenticación (60 min)
                </h3>
                <p
                  style={{
                    margin: 0,
                    marginBottom: 4,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: strongText,
                  }}
                >
                  {metrics.auth?.success_logins_last_60m ?? 0} logins exitosos
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    color: "#fca5a5",
                  }}
                >
                  {metrics.auth?.failed_logins_last_60m ?? 0} intentos fallidos
                </p>
              </div>

              <div
                className="card"
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: `1px solid ${cardBorder}`,
                  background:
                    "radial-gradient(circle at top left, rgba(250,204,21,0.1), transparent 60%)",
                  boxShadow: "0 20px 45px rgba(15,23,42,0.55)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: subtleText,
                  }}
                >
                  Documentos (60 min)
                </h3>

                {!hasDocActivity ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      color: subtleText,
                    }}
                  >
                    Sin actividad reciente.
                  </p>
                ) : (
                  <ul
                    style={{
                      paddingLeft: 18,
                      margin: 0,
                      marginTop: 4,
                      fontSize: "0.85rem",
                      color: strongText,
                    }}
                  >
                    {docActions.map((row) => (
                      <li key={row.action}>
                        <span
                          style={{
                            color: subtleText,
                            marginRight: 4,
                          }}
                        >
                          {row.action}:
                        </span>
                        <strong>{row.total}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className="card"
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: `1px solid ${cardBorder}`,
                  background:
                    "radial-gradient(circle at top left, rgba(139,92,246,0.12), transparent 60%)",
                  boxShadow: "0 20px 45px rgba(15,23,42,0.55)",
                  minWidth: 220,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: subtleText,
                  }}
                >
                  Usuarios
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: strongText,
                  }}
                >
                  {metrics.users?.created_last_24h ?? 0}
                </p>
                <p
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontSize: "0.85rem",
                    color: subtleText,
                  }}
                >
                  Nuevos usuarios en las últimas 24 horas
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}