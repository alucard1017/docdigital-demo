// src/views/UsersAdminView.jsx
import { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import { UserForm } from "../components/UserForm";

function normalizeRun(run) {
  return (run || "").replace(/[.\-]/g, "");
}

function formatRunVisual(value) {
  const clean = (value || "").replace(/[^0-9kK]/g, "");
  if (!clean) return "";
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

function esAdminPotente(role) {
  return role === "ADMIN" || role === "ADMIN_GLOBAL" || role === "SUPER_ADMIN";
}

export function UsersAdminView() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const isSuper = currentUser?.role === "SUPER_ADMIN";
  const isGlobal = currentUser?.role === "ADMIN_GLOBAL";
  const isAdmin = currentUser?.role === "ADMIN";
  const canManage = isSuper || isGlobal || isAdmin;

  const OWNER_RUN = useMemo(
    () => normalizeRun(import.meta.env.VITE_ADMIN_RUN || "1053806586"),
    []
  );
  const currentRunNorm = normalizeRun(currentUser?.run);
  const isOwner = currentRunNorm === OWNER_RUN;

  async function cargarUsuarios() {
    setLoading(true);
    setError("");

    try {
      const params =
        roleFilter && roleFilter !== "todos" ? { role: roleFilter } : {};
      const res = await api.get("/users", { params });
      const data = res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudieron cargar los usuarios";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function cargarStats() {
    try {
      const res = await api.get("/stats");
      const data = res.data;
      setStats(data);
    } catch (e) {
      console.error("Error cargando stats:", e);
    }
  }

  useEffect(() => {
    cargarUsuarios();
    cargarStats();
  }, [roleFilter]);

  function handleNewUser() {
    if (!canManage) {
      alert("No tienes permisos para crear usuarios.");
      return;
    }
    setEditingUser(null);
    setShowForm(true);
  }

  function handleEditUser(user) {
    if (!canManage) {
      alert("No tienes permisos para editar usuarios.");
      return;
    }

    const isTargetOwner = normalizeRun(user.run) === OWNER_RUN;
    const isTargetAdminLike = esAdminPotente(user.role);

    if (isTargetOwner && !isOwner) {
      alert("No puedes modificar la cuenta principal del sistema.");
      return;
    }

    if (isTargetAdminLike && !isOwner && !isSuper) {
      alert(
        "Solo el dueño o el super admin pueden modificar otros administradores."
      );
      return;
    }

    setEditingUser(user);
    setShowForm(true);
  }

  function handleUserSaved() {
    setShowForm(false);
    setEditingUser(null);
    cargarUsuarios();
  }

  async function toggleActive(user) {
    if (!canManage) {
      alert("No tienes permisos para cambiar el estado de usuarios.");
      return;
    }

    const isTargetOwner = normalizeRun(user.run) === OWNER_RUN;
    const isTargetAdminLike = esAdminPotente(user.role);

    if (isTargetOwner) {
      alert("No puedes desactivar la cuenta principal del sistema.");
      return;
    }

    if (isTargetAdminLike && !isOwner && !isSuper) {
      alert(
        "Solo el dueño o el super admin pueden desactivar administradores."
      );
      return;
    }

    try {
      setSaving(true);
      const res = await api.put(`/users/${user.id}`, {
        active: !user.active,
      });
      if (!res || !res.data) {
        throw new Error("No se pudo actualizar el estado");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u))
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al cambiar estado del usuario";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(user) {
    if (!canManage) {
      alert("No tienes permisos para resetear contraseñas.");
      return;
    }

    const confirmMsg = `¿Seguro que deseas resetear la contraseña de ${
      user.name || user.email || "este usuario"
    }?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setSaving(true);
      const res = await api.post(`/users/${user.id}/reset-password`);
      const data = res.data;
      alert(
        data?.message ||
          "Contraseña temporal generada. El usuario debe revisar su correo."
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al resetear la contraseña.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(user) {
    if (!canManage) {
      alert("No tienes permisos para eliminar usuarios.");
      return;
    }

    const isTargetOwner = normalizeRun(user.run) === OWNER_RUN;
    const isTargetAdminLike = esAdminPotente(user.role);

    if (isTargetOwner) {
      alert("No puedes eliminar la cuenta principal del sistema.");
      return;
    }

    if (isTargetAdminLike && !isOwner && !isSuper && !isGlobal) {
      alert(
        "Solo el dueño, super admin o admin global pueden eliminar administradores."
      );
      return;
    }

    const ok = window.confirm(
      `¿Seguro que deseas eliminar al usuario "${user.name || "-"}" (${
        user.email || user.run
      })? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      setSaving(true);
      const res = await api.delete(`/users/${user.id}`);
      const data = res.data;
      alert(data?.message || "Usuario eliminado correctamente");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al eliminar usuario";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  const titulo = useMemo(() => {
    if (isSuper) return "Panel maestro de usuarios (SUPER ADMIN)";
    if (isGlobal) return "Panel global de usuarios";
    if (isAdmin) return "Usuarios de tu empresa";
    return "Usuarios";
  }, [isSuper, isGlobal, isAdmin]);

  const descripcionPermisos = useMemo(() => {
    if (isOwner || isSuper) {
      return "Puedes ver y administrar todos los usuarios y roles del sistema.";
    }
    if (isGlobal) {
      return "Puedes ver todos los usuarios y administrar sus cuentas (excepto la cuenta principal).";
    }
    if (isAdmin) {
      return "Puedes ver y administrar solo los usuarios de tu empresa.";
    }
    return "Solo lectura sobre usuarios asignados.";
  }, [isOwner, isSuper, isGlobal, isAdmin]);

  if (loading && !users.length) {
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
        <button className="btn-main btn-primary" onClick={cargarUsuarios}>
          Reintentar carga
        </button>
      </div>
    );
  }

  return (
    <div className="card-premium">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#e5e7eb",
            }}
          >
            {titulo}
          </h2>
          {currentUser && (
            <>
              <p
                style={{
                  margin: 0,
                  marginTop: 4,
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                }}
              >
                Sesión: {currentUser.email} · Rol: {currentUser.role}
              </p>
              <p
                style={{
                  margin: 0,
                  marginTop: 2,
                  fontSize: "0.78rem",
                  color: "#6b7280",
                }}
              >
                {descripcionPermisos}
              </p>
            </>
          )}
        </div>

        {canManage && (
          <button
            className="btn-main btn-primary"
            onClick={handleNewUser}
            disabled={saving}
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      {/* KPIs */}
      {stats && stats.documentos && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div className="kpi-card">
            <div className="kpi-label">Total documentos</div>
            <div className="kpi-value">{stats.documentos.total || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Pendientes</div>
            <div className="kpi-value">{stats.documentos.pendientes || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Firmados</div>
            <div className="kpi-value">{stats.documentos.firmados || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Visados</div>
            <div className="kpi-value">{stats.documentos.visados || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Rechazados</div>
            <div className="kpi-value">
              {stats.documentos.rechazados || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filtro de rol */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          {isSuper || isGlobal
            ? "Puedes ver usuarios de todas las empresas."
            : "Ves solo los usuarios de tu empresa."}
        </div>

        <label
          style={{
            fontSize: "0.85rem",
            color: "#cbd5f5",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Rol:
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              fontSize: "0.85rem",
              background: "#020617",
              color: "#e5e7eb",
            }}
          >
            <option value="todos">Todos</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ADMIN_GLOBAL">Admin global</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">Usuario</option>
          </select>
        </label>
      </div>

      {/* Tabla o vacío */}
      {users.length === 0 ? (
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
      ) : (
        <div
          style={{
            background: "#020617",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div className="table-scroll-container">
            <div
              className="table-wrapper"
              style={{
                borderRadius: 12,
                background: "#020617",
                border: "1px solid #1f2937",
                overflowX: "auto",
              }}
            >
              <table
                className="doc-table"
                style={{
                  minWidth: 900,
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>ID</th>
                    <th style={{ width: 130 }}>RUN / NIT</th>
                    <th style={{ width: 180 }}>Nombre completo</th>
                    <th style={{ width: 220, textAlign: "center" }}>Correo</th>
                    <th style={{ width: 80, textAlign: "center" }}>Empresa</th>
                    <th
                      className="col-role"
                      style={{ width: 120, textAlign: "center" }}
                    >
                      Rol
                    </th>
                    <th
                      className="col-plan"
                      style={{ width: 90, textAlign: "center" }}
                    >
                      Plan
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        width: 90,
                      }}
                    >
                      Estado
                    </th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isInactive = u.active === false;
                    const isTargetOwner = normalizeRun(u.run) === OWNER_RUN;
                    const isTargetAdminLike = esAdminPotente(u.role);

                    const canToggle =
                      canManage &&
                      !isTargetOwner &&
                      (isOwner || !isTargetAdminLike);

                    const canEditRow =
                      canManage &&
                      (!isTargetOwner || isOwner) &&
                      (isOwner || !isTargetAdminLike);

                    const canReset = canEditRow;
                    const canDelete =
                      canManage &&
                      !isTargetOwner &&
                      (isOwner || isSuper || isGlobal || !isTargetAdminLike);

                    return (
                      <tr
                        key={u.id}
                        className={isInactive ? "row-inactive" : ""}
                        style={
                          isInactive
                            ? { opacity: 0.6, backgroundColor: "#020617" }
                            : {}
                        }
                      >
                        <td>{u.id}</td>
                        <td>{formatRunVisual(u.run) || "-"}</td>
                        <td>{u.name || "-"}</td>
                        <td style={{ textAlign: "center" }}>
                          {u.email || "-"}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 0",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              minWidth: 36,
                              padding: "2px 6px",
                              borderRadius: 9999,
                              backgroundColor: "#0f172a",
                              fontSize: "0.75rem",
                              color: "#e5e7eb",
                            }}
                          >
                            {u.company_id ?? "-"}
                          </span>
                        </td>
                        <td
                          className="col-role"
                          style={{ textAlign: "center" }}
                        >
                          <span
                            className="badge-role"
                            data-role={u.role || "USER"}
                          >
                            {u.role || "USER"}
                          </span>
                        </td>
                        <td
                          className="col-plan"
                          style={{ textAlign: "center" }}
                        >
                          {u.plan ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 9999,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor:
                                  u.plan.toLowerCase() === "pro"
                                    ? "#1d4ed8"
                                    : "#111827",
                                color: "#e5e7eb",
                              }}
                            >
                              {u.plan.toUpperCase()}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                          }}
                        >
                          {canToggle ? (
                            <button
                              type="button"
                              onClick={() => toggleActive(u)}
                              className="btn-pill"
                              disabled={saving}
                              style={
                                u.active
                                  ? {
                                      background: "#022c22",
                                      color: "#6ee7b7",
                                      border: "1px solid #059669",
                                    }
                                  : {
                                      background: "#111827",
                                      color: "#9ca3af",
                                      border: "1px solid #4b5563",
                                    }
                              }
                            >
                              {u.active ? "ACTIVO" : "INACTIVO"}
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              {u.active ? "ACTIVO" : "INACTIVO"}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEditRow && (
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => handleEditUser(u)}
                              style={{ marginRight: 8 }}
                            >
                              Editar
                            </button>
                          )}
                          {canReset && (
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => handleResetPassword(u)}
                              disabled={saving}
                              style={{ marginRight: 8 }}
                            >
                              Resetear clave
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-link btn-link-danger"
                              onClick={() => handleDeleteUser(u)}
                              disabled={saving}
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          currentUser={currentUser}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}