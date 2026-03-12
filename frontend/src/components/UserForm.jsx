// src/components/UserForm.jsx
import { useEffect, useMemo, useState } from "react";

function normalizeRun(run) {
  return (run || "").replace(/[.\-]/g, "");
}

function formatRunVisual(value) {
  let clean = (value || "").replace(/[^0-9kK]/g, "");
  if (!clean) return "";
  if (clean.length > 10) clean = clean.slice(0, 10);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

export function UserForm({
  API_URL,
  token,
  user,
  currentUser,
  onClose,
  onSaved,
}) {
  const isEdit = !!user?.id;

  const [form, setForm] = useState({
    run: "",
    name: "",
    email: "",
    plan: "basic",
    role: "USER",
    active: true,
    password: "",
    company_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const OWNER_RUN = useMemo(
    () => normalizeRun(import.meta.env.VITE_ADMIN_RUN || "1053806586"),
    []
  );
  const currentRunNorm = normalizeRun(currentUser?.run);
  const isOwner = currentRunNorm === OWNER_RUN;
  const isSuper = currentUser?.role === "SUPER_ADMIN";
  const isGlobal = currentUser?.role === "ADMIN_GLOBAL";
  const isAdmin = currentUser?.role === "ADMIN";

  const availableRoles = useMemo(() => {
    if (isOwner || isSuper) {
      return ["SUPER_ADMIN", "ADMIN_GLOBAL", "ADMIN", "USER"];
    }
    if (isGlobal) {
      return ["ADMIN", "USER"];
    }
    if (isAdmin) {
      return ["ADMIN", "USER"];
    }
    return ["USER"];
  }, [isOwner, isSuper, isGlobal, isAdmin]);

  useEffect(() => {
    if (user) {
      setForm({
        run: user.run || "",
        name: user.name || "",
        email: user.email || "",
        plan: user.plan || "basic",
        role: user.role || "USER",
        active: typeof user.active === "boolean" ? user.active : true,
        password: "",
        company_id: user.company_id ?? "",
      });
    } else {
      setForm({
        run: "",
        name: "",
        email: "",
        plan: "basic",
        role: "USER",
        active: true,
        password: "",
        company_id: currentUser?.company_id ?? "",
      });
    }
    setError("");
    setFieldErrors({});
  }, [user, currentUser]);

  // Cargar listado de empresas para el dropdown
  useEffect(() => {
    if (!token) return;
    setLoadingCompanies(true);
    fetch(`${API_URL}/api/companies`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          setCompanies([]);
        }
      })
      .catch((err) => {
        console.error("Error cargando companies:", err);
        setCompanies([]);
      })
      .finally(() => setLoadingCompanies(false));
  }, [API_URL, token]);

  useEffect(() => {
    if (!availableRoles.includes(form.role)) {
      setForm((prev) => ({
        ...prev,
        role: availableRoles[availableRoles.length - 1] || "USER",
      }));
    }
  }, [availableRoles, form.role]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "run") {
      const clean = value.replace(/[^0-9kK]/g, "");
      setForm((prev) => ({
        ...prev,
        run: clean,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function validate() {
    const errs = {};

    if (!form.run) {
      errs.run = "RUN es obligatorio";
    }
    if (!form.name) {
      errs.name = "Nombre es obligatorio";
    }

    if (!isEdit && !form.password) {
      errs.password = "La contraseña es obligatoria al crear usuario";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSaving(true);

    try {
      const payload = {
        run: normalizeRun(form.run),
        name: form.name,
        email: form.email,
        plan: form.plan,
        role: form.role,
        active: form.active,
        company_id: form.company_id || undefined,
      };

      if (form.password) {
        payload.password = form.password;
      }

      const url = isEdit
        ? `${API_URL}/api/users/${user.id}`
        : `${API_URL}/api/users`;
      const method = isEdit ? "PUT" : "POST";

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

  const titulo = isEdit ? "Editar usuario" : "Nuevo usuario";
  const canEditRole = isOwner || isSuper || isGlobal || isAdmin;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{titulo}</h3>

        {currentUser && (
          <p
            style={{
              marginTop: 0,
              marginBottom: 12,
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            Estás creando/editando como {currentUser.email} ({currentUser.role})
          </p>
        )}

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
              value={formatRunVisual(form.run)}
              onChange={handleChange}
              className="form-input"
              required
            />
            {fieldErrors.run && (
              <span className="field-error">{fieldErrors.run}</span>
            )}
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
            {fieldErrors.name && (
              <span className="field-error">{fieldErrors.name}</span>
            )}
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
            Empresa
            <select
              name="company_id"
              value={form.company_id || ""}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">
                {loadingCompanies
                  ? "Cargando empresas..."
                  : "Sin empresa / no asignada"}
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (ID {c.id})
                </option>
              ))}
            </select>
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
              disabled={!canEditRole}
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r === "SUPER_ADMIN"
                    ? "Super admin"
                    : r === "ADMIN_GLOBAL"
                    ? "Admin global"
                    : r === "ADMIN"
                    ? "Admin empresa"
                    : "Usuario"}
                </option>
              ))}
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
            {fieldErrors.password && (
              <span className="field-error">{fieldErrors.password}</span>
            )}
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
