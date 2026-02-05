import { useEffect, useState } from "react";

export function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  async function cargarUsuarios() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("No se pudieron cargar los usuarios");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(id, field, value) {
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, [field]: value } : u))
    );
  }

  async function guardarUsuario(user) {
    try {
      setSavingId(user.id);
      setError("");
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          run: user.run,
          name: user.name,
          email: user.email,
          plan: user.plan,
          role: user.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo guardar el usuario");
      }
      const updated = await res.json();
      setUsers(prev =>
        prev.map(u => (u.id === updated.id ? updated : u))
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Error guardando usuario");
    } finally {
      setSavingId(null);
    }
  }

  async function eliminarUsuario(id) {
    if (!window.confirm("¿Seguro que quieres eliminar este usuario?")) return;

    try {
      setSavingId(id);
      setError("");
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo eliminar el usuario");
      }
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
      setError(err.message || "Error eliminando usuario");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: "2rem" }}>Cargando usuarios...</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Usuarios del sistema</h2>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <p>No hay usuarios para mostrar.</p>
      ) : (
        <table className="tabla-usuarios">
          <thead>
            <tr>
              <th>ID</th>
              <th>RUN</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>
                  <input
                    type="text"
                    value={u.run || ""}
                    onChange={e => handleChange(u.id, "run", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={u.name || ""}
                    onChange={e => handleChange(u.id, "name", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="email"
                    value={u.email || ""}
                    onChange={e => handleChange(u.id, "email", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={u.plan || "basic"}
                    onChange={e => handleChange(u.id, "plan", e.target.value)}
                  >
                    <option value="basic">basic</option>
                    <option value="pro">pro</option>
                  </select>
                </td>
                <td>
                  <select
                    value={u.role || "user"}
                    onChange={e => handleChange(u.id, "role", e.target.value)}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="admin_global">admin_global</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => guardarUsuario(u)}
                    disabled={savingId === u.id}
                  >
                    {savingId === u.id ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    style={{ marginLeft: "0.5rem" }}
                    onClick={() => eliminarUsuario(u.id)}
                    disabled={savingId === u.id}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
