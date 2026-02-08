import { useEffect, useState } from "react";

export function UsersAdminView({ API_URL, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargarUsuarios() {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No se pudieron cargar los usuarios");
      }

      setUsers(data);
    } catch (err) {
      setError(err.message || "Error de conexión al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#64748b",
        }}
      >
        <div style={{ marginBottom: 12, fontWeight: 600 }}>
          Cargando usuarios del sistema…
        </div>
        <p
          style={{
            fontSize: "0.9rem",
            color: "#9ca3af",
            marginTop: 4,
          }}
        >
          Esto puede tardar unos segundos.
        </p>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#b91c1c",
        }}
      >
        <p style={{ marginBottom: 8, fontWeight: 700 }}>
          Ocurrió un problema al cargar los usuarios.
        </p>
        <p style={{ marginBottom: 16, fontSize: "0.9rem" }}>{error}</p>
        <button
          className="btn-main btn-primary"
          onClick={cargarUsuarios}
        >
          Reintentar carga
        </button>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#64748b",
        }}
      >
        <h3 style={{ marginBottom: 8 }}>No hay usuarios para mostrar.</h3>
        <p
          style={{
            marginBottom: 4,
            fontSize: "0.9rem",
            color: "#94a3b8",
          }}
        >
          Cuando registres nuevos usuarios, aparecerán en este panel.
        </p>
      </div>
    );
  }

  return (
    <div className="card-premium">
      <h2
        style={{
          marginTop: 0,
          marginBottom: 16,
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Administración de usuarios
      </h2>

      <div className="table-wrapper">
        <table className="doc-table">
          <thead>
            <tr>
              <th>RUN / NIT</th>
              <th>Nombre completo</th>
              <th>Correo</th>
              <th>Rol</th>
              <th style={{ textAlign: "center" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.run || u.rut || "-"}</td>
                <td>{u.nombre || u.full_name || "-"}</td>
                <td>{u.email}</td>
                <td>{u.role || "usuario"}</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    className="status-badge"
                    style={
                      u.active
                        ? {
                            background: "#f0fdf4",
                            color: "#15803d",
                            border: "1px solid #bbf7d0",
                          }
                        : {
                            background: "#f9fafb",
                            color: "#64748b",
                            border: "1px solid #e5e7eb",
                          }
                    }
                  >
                    {u.active ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
