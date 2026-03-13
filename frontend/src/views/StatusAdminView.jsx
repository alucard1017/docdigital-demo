// src/views/StatusAdminView.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

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

  return (
    <div className="status-admin-view" style={{ padding: 24 }}>
      <h2
        style={{
          fontSize: "1.4rem",
          margin: 0,
          marginBottom: 4,
        }}
      >
        Estado del sistema
      </h2>

      <p
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: "0.95rem",
          color: "#64748b",
        }}
      >
        Revisa la salud de la API, base de datos y actividad reciente.
      </p>

      {error && (
        <p
          style={{
            marginTop: 4,
            marginBottom: 12,
            fontSize: "0.9rem",
            color: "#b91c1c",
          }}
        >
          Error: {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          className="btn-main btn-primary"
          onClick={fetchAll}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Refrescar"}
        </button>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            throw new Error("Test manual de Sentry desde StatusAdminView");
          }}
        >
          Probar error Sentry
        </button>
      </div>

      <div
        className="status-cards"
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {health && (
          <div
            className="card"
            style={{
              minWidth: 260,
              padding: 16,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: "1rem",
              }}
            >
              API
            </h3>
            <p style={{ margin: 0 }}>Estado: {health.status}</p>
            <p style={{ margin: 0 }}>Uptime: {health.uptime_seconds} s</p>
            <p style={{ margin: 0 }}>
              Hora: {new Date(health.timestamp).toLocaleString()}
            </p>
            <p style={{ margin: 0 }}>DB: {health.checks?.database}</p>
            <p style={{ margin: 0 }}>Storage: {health.checks?.storage}</p>
          </div>
        )}

        {metrics && (
          <>
            <div
              className="card"
              style={{
                minWidth: 260,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: 8,
                  fontSize: "1rem",
                }}
              >
                Autenticación (60 min)
              </h3>
              <p style={{ margin: 0 }}>
                Logins exitosos: {metrics.auth?.success_logins_last_60m}
              </p>
              <p style={{ margin: 0, color: "#b91c1c" }}>
                Logins fallidos: {metrics.auth?.failed_logins_last_60m}
              </p>
            </div>

            <div
              className="card"
              style={{
                minWidth: 260,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: 8,
                  fontSize: "1rem",
                }}
              >
                Acciones de documentos (60 min)
              </h3>
              {metrics.documents?.actions_last_60m?.length === 0 ? (
                <p style={{ margin: 0 }}>Sin actividad reciente.</p>
              ) : (
                <ul
                  style={{
                    paddingLeft: 18,
                    margin: 0,
                    marginTop: 4,
                    fontSize: "0.85rem",
                  }}
                >
                  {metrics.documents.actions_last_60m.map((row) => (
                    <li key={row.action}>
                      {row.action}: {row.total}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="card"
              style={{
                minWidth: 220,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: 8,
                  fontSize: "1rem",
                }}
              >
                Usuarios
              </h3>
              <p style={{ margin: 0 }}>
                Creaciones últimas 24h: {metrics.users?.created_last_24h}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
