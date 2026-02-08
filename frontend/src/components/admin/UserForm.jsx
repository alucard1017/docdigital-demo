import { useEffect, useState } from "react";

export function UserForm({ API_URL, token, user, onClose, onSaved }) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    run: "",
    name: "",
    email: "",
    plan: "basic",
    role: "admin",
    active: true,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        run: user.run || "",
        name: user.name || "",
        email: user.email || "",
        plan: user.plan || "basic",
        role: user.role || "admin",
        active: typeof user.active === "boolean" ? user.active : true,
        password: "",
      }));
    }
  }, [user]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEdit
        ? `${API_URL}/api/users/${user.id}`
        : `${API_URL}/api/users`;

      const method = isEdit ? "PUT" : "POST";

      const payload = {
        run: form.run,
        name: form.name,
        email: form.email,
        plan: form.plan,
        role: form.role,
        active: form.active,
      };

      if (!isEdit && form.password) {
        payload.password = form.password;
      }
      if (isEdit && form.password) {
        payload.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No se pudo guardar el usuario");
      }

      onSaved?.(data);
      onClose?.();
    } catch (err) {
      setError(err.message || "Error de conexión al guardar usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>
          {isEdit ? "Editar usuario" : "Nuevo usuario"}
        </h3>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 8,
              borderRadius: 6,
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-vertical">
          <label className="form-label">
            RUN / NIT
            <input
              name="run"
              value={form.run}
              onChange={handleChange}
              className="form-input"
              required
            />
          </label>

          <label className="form-label">
            Nombre completo
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="form-input"
              required
            />
          </label>

          <label className="form-label">
            Correo
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="form-input"
            />
          </label>

          <label className="form-label">
            Plan
            <select
              name="plan"
              value={form.plan}
              onChange={handleChange}
              className="form-input"
            >
              <option value="basic">Básico</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          <label className="form-label">
            Rol
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="form-input"
            >
              <option value="admin">Admin</option>
              <option value="admin_global">Admin global</option>
              <option value="user">Usuario</option>
            </select>
          </label>

          <label
            className="form-label"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
            Usuario activo
          </label>

          <label className="form-label">
            Contraseña {isEdit ? "(dejar en blanco para no cambiar)" : ""}
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="form-input"
              placeholder={isEdit ? "••••••••" : ""}
            />
          </label>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-main btn-primary"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
