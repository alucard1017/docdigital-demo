// src/views/UsersAdminView.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/client";
import { UserForm } from "../components/UserForm";
import ConfirmDialog from "../components/feedback/ConfirmDialog";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import "../styles/usersAdmin.css";
import {
  normalizeRun,
  formatRun,
  getRoleLabel,
  isAdminLikeRole,
} from "../utils/formatters";

function getPlanBadgeClass(plan) {
  const normalized = String(plan || "").toLowerCase();
  return normalized === "pro" ? "badge-plan is-pro" : "badge-plan is-basic";
}

const initialConfirmState = {
  open: false,
  action: null,
  user: null,
  loading: false,
};

function UsersAdminView() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(initialConfirmState);

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

  const closeConfirmDialog = useCallback(() => {
    setConfirmState((prev) => {
      if (prev.loading) return prev;
      return initialConfirmState;
    });
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params =
        roleFilter && roleFilter !== "todos" ? { role: roleFilter } : {};

      const res = await api.get("/users", { params });
      const data = res?.data;

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudieron cargar los usuarios";

      setError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/stats");
      setStats(res?.data || null);
    } catch (err) {
      console.error("Error cargando stats:", err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  const openCreateUser = useCallback(() => {
    if (!canManage) {
      addToast({
        type: "error",
        title: "Acceso denegado",
        message: "No tienes permisos para crear usuarios.",
      });
      return;
    }

    setEditingUser(null);
    setShowForm(true);
  }, [canManage, addToast]);

  const openEditUser = useCallback(
    (targetUser) => {
      if (!canManage) {
        addToast({
          type: "error",
          title: "Acceso denegado",
          message: "No tienes permisos para editar usuarios.",
        });
        return;
      }

      const isTargetOwner = normalizeRun(targetUser.run) === OWNER_RUN;
      const isTargetAdminLike = isAdminLikeRole(targetUser.role);

      if (isTargetOwner && !isOwner) {
        addToast({
          type: "error",
          title: "Acción no permitida",
          message: "No puedes modificar la cuenta principal del sistema.",
        });
        return;
      }

      if (isTargetAdminLike && !isOwner && !isSuper) {
        addToast({
          type: "error",
          title: "Acción restringida",
          message:
            "Solo el dueño o el super admin pueden modificar otros administradores.",
        });
        return;
      }

      setEditingUser(targetUser);
      setShowForm(true);
    },
    [canManage, addToast, OWNER_RUN, isOwner, isSuper]
  );

  const handleUserSaved = useCallback(
    async () => {
      setShowForm(false);
      setEditingUser(null);
      await loadUsers();

      addToast({
        type: "success",
        title: "Usuario guardado",
        message: "Los cambios se guardaron correctamente.",
      });
    },
    [loadUsers, addToast]
  );

  const toggleActive = useCallback(
    async (targetUser) => {
      if (!canManage) {
        addToast({
          type: "error",
          title: "Acceso denegado",
          message: "No tienes permisos para cambiar el estado de usuarios.",
        });
        return;
      }

      const isTargetOwner = normalizeRun(targetUser.run) === OWNER_RUN;
      const isTargetAdminLike = isAdminLikeRole(targetUser.role);

      if (isTargetOwner) {
        addToast({
          type: "error",
          title: "Acción no permitida",
          message: "No puedes desactivar la cuenta principal del sistema.",
        });
        return;
      }

      if (isTargetAdminLike && !isOwner && !isSuper) {
        addToast({
          type: "error",
          title: "Acción restringida",
          message:
            "Solo el dueño o el super admin pueden desactivar administradores.",
        });
        return;
      }

      try {
        setSaving(true);

        const res = await api.put(`/users/${targetUser.id}`, {
          active: !targetUser.active,
        });

        if (!res?.data) {
          throw new Error("No se pudo actualizar el estado");
        }

        setUsers((prev) =>
          prev.map((user) =>
            user.id === targetUser.id
              ? { ...user, active: !user.active }
              : user
          )
        );

        addToast({
          type: "success",
          title: "Estado actualizado",
          message: `El usuario ahora está ${
            !targetUser.active ? "activo" : "inactivo"
          }.`,
        });
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al cambiar estado del usuario";

        addToast({
          type: "error",
          title: "No se pudo actualizar",
          message: msg,
        });
      } finally {
        setSaving(false);
      }
    },
    [canManage, addToast, OWNER_RUN, isOwner, isSuper]
  );

  const openResetPasswordDialog = useCallback(
    (targetUser) => {
      if (!canManage) {
        addToast({
          type: "error",
          title: "Acceso denegado",
          message: "No tienes permisos para resetear contraseñas.",
        });
        return;
      }

      setConfirmState({
        open: true,
        action: "reset-password",
        user: targetUser,
        loading: false,
      });
    },
    [canManage, addToast]
  );

  const openDeleteUserDialog = useCallback(
    (targetUser) => {
      if (!canManage) {
        addToast({
          type: "error",
          title: "Acceso denegado",
          message: "No tienes permisos para eliminar usuarios.",
        });
        return;
      }

      const isTargetOwner = normalizeRun(targetUser.run) === OWNER_RUN;
      const isTargetAdminLike = isAdminLikeRole(targetUser.role);

      if (isTargetOwner) {
        addToast({
          type: "error",
          title: "Acción no permitida",
          message: "No puedes eliminar la cuenta principal del sistema.",
        });
        return;
      }

      if (isTargetAdminLike && !isOwner && !isSuper && !isGlobal) {
        addToast({
          type: "error",
          title: "Acción restringida",
          message:
            "Solo el dueño, super admin o admin global pueden eliminar administradores.",
        });
        return;
      }

      setConfirmState({
        open: true,
        action: "delete",
        user: targetUser,
        loading: false,
      });
    },
    [canManage, addToast, OWNER_RUN, isOwner, isSuper, isGlobal]
  );

  const handleConfirmAction = useCallback(
    async () => {
      const { action, user } = confirmState;
      if (!action || !user) return;

      try {
        setConfirmState((prev) => ({ ...prev, loading: true }));
        setSaving(true);

        if (action === "reset-password") {
          const res = await api.post(`/users/${user.id}/reset-password`);
          const data = res?.data;

          addToast({
            type: "success",
            title: "Contraseña reseteada",
            message:
              data?.message ||
              "Contraseña temporal generada. El usuario debe revisar su correo.",
          });
        }

        if (action === "delete") {
          const res = await api.delete(`/users/${user.id}`);
          const data = res?.data;

          setUsers((prev) => prev.filter((u) => u.id !== user.id));

          addToast({
            type: "success",
            title: "Usuario eliminado",
            message: data?.message || "Usuario eliminado correctamente.",
          });
        }

        setConfirmState(initialConfirmState);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          (action === "delete"
            ? "Error al eliminar usuario"
            : "Error al resetear la contraseña.");

        addToast({
          type: "error",
          title: "No se pudo completar la acción",
          message: msg,
        });

        setConfirmState((prev) => ({ ...prev, loading: false }));
      } finally {
        setSaving(false);
      }
    },
    [confirmState, addToast]
  );

  const title = useMemo(() => {
    if (isSuper) return "Panel maestro de usuarios";
    if (isGlobal) return "Panel global de usuarios";
    if (isAdmin) return "Usuarios de tu empresa";
    return "Usuarios";
  }, [isSuper, isGlobal, isAdmin]);

  const permissionsDescription = useMemo(() => {
    if (isOwner || isSuper) {
      return "Puedes ver y administrar todos los usuarios y roles del sistema.";
    }

    if (isGlobal) {
      return "Puedes ver todos los usuarios y administrar sus cuentas, excepto la cuenta principal.";
    }

    if (isAdmin) {
      return "Puedes ver y administrar solo los usuarios de tu empresa.";
    }

    return "Solo lectura sobre usuarios asignados.";
  }, [isOwner, isSuper, isGlobal, isAdmin]);

  if (loading && !users.length) {
    return (
      <div className="users-admin-state is-loading">
        <div className="users-admin-state-title">
          Cargando usuarios del sistema…
        </div>
        <p className="users-admin-state-subtext">
          Esto puede tardar unos segundos.
        </p>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-admin-state is-error">
        <p className="users-admin-state-title">
          Ocurrió un problema al cargar los usuarios.
        </p>
        <p className="users-admin-state-text">{error}</p>
        <button className="btn-main btn-primary" onClick={loadUsers}>
          Reintentar carga
        </button>
      </div>
    );
  }

  return (
    <div className="card-premium users-admin-card">
      <div className="users-admin-header">
        <div className="users-admin-header-main">
          <h2 className="users-admin-title">{title}</h2>

          {currentUser && (
            <>
              <p className="users-admin-session">
                Sesión: {currentUser.email} · Rol:{" "}
                {getRoleLabel(currentUser.role)}
              </p>
              <p className="users-admin-permissions">
                {permissionsDescription}
              </p>
            </>
          )}
        </div>

        {canManage && (
          <button
            className="btn-main btn-primary"
            onClick={openCreateUser}
            disabled={saving}
            aria-label="Crear nuevo usuario"
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      {stats?.documentos && (
        <div className="users-admin-kpis">
          <div className="kpi-card">
            <div className="kpi-label">Total documentos</div>
            <div className="kpi-value">{stats.documentos.total || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Pendientes</div>
            <div className="kpi-value">
              {stats.documentos.pendientes || 0}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Firmados</div>
            <div className="kpi-value">
              {stats.documentos.firmados || 0}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Visados</div>
            <div className="kpi-value">
              {stats.documentos.visados || 0}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Rechazados</div>
            <div className="kpi-value">
              {stats.documentos.rechazados || 0}
            </div>
          </div>
        </div>
      )}

      <div className="users-admin-toolbar">
        <div className="users-admin-toolbar-text">
          {isSuper || isGlobal
            ? "Puedes ver usuarios de todas las empresas."
            : "Ves solo los usuarios de tu empresa."}
        </div>

        <label className="users-admin-filter">
          Rol:
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="users-admin-select"
          >
            <option value="todos">Todos</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ADMIN_GLOBAL">Admin global</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">Usuario</option>
          </select>
        </label>
      </div>

      {users.length === 0 ? (
        <div className="users-admin-state is-empty">
          <h3 className="users-admin-state-title">
            No hay usuarios para mostrar.
          </h3>
          <p className="users-admin-state-text">
            Cuando registres nuevos usuarios, aparecerán en este panel.
          </p>
        </div>
      ) : (
        <div className="users-admin-table-shell">
          <div className="table-scroll-container">
            <div className="table-wrapper users-admin-table-inner">
              <table className="doc-table doc-table-users">
                <thead>
                  <tr>
                    <th className="col-user-id">ID</th>
                    <th className="col-user-run">RUN / NIT</th>
                    <th className="col-user-name">Nombre completo</th>
                    <th className="col-user-email">Correo</th>
                    <th className="col-user-company">Empresa</th>
                    <th className="col-user-role">Rol</th>
                    <th className="col-user-plan">Plan</th>
                    <th className="col-user-status">Estado</th>
                    <th className="col-user-actions">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((targetUser) => {
                    const isInactive = targetUser.active === false;
                    const isTargetOwner =
                      normalizeRun(targetUser.run) === OWNER_RUN;
                    const isTargetAdminLike = isAdminLikeRole(
                      targetUser.role
                    );

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
                      (isOwner ||
                        isSuper ||
                        isGlobal ||
                        !isTargetAdminLike);

                    return (
                      <tr
                        key={targetUser.id}
                        className={isInactive ? "row-inactive" : ""}
                      >
                        <td>{targetUser.id}</td>
                        <td>{formatRun(targetUser.run) || "-"}</td>
                        <td>{targetUser.name || "-"}</td>
                        <td className="col-user-email">
                          {targetUser.email || "-"}
                        </td>

                        <td className="col-user-company">
                          <span className="badge-plan is-basic users-company-badge">
                            {targetUser.company_id ?? "-"}
                          </span>
                        </td>

                        <td className="col-user-role">
                          <span
                            className="badge-role"
                            data-role={targetUser.role || "USER"}
                          >
                            {targetUser.role || "USER"}
                          </span>
                        </td>

                        <td className="col-user-plan">
                          {targetUser.plan ? (
                            <span className={getPlanBadgeClass(targetUser.plan)}>
                              {targetUser.plan.toUpperCase()}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="col-user-status">
                          {canToggle ? (
                            <button
                              type="button"
                              onClick={() => toggleActive(targetUser)}
                              className={`btn-pill ${
                                targetUser.active
                                  ? "is-active"
                                  : "is-inactive"
                              }`}
                              disabled={saving}
                            >
                              {targetUser.active ? "ACTIVO" : "INACTIVO"}
                            </button>
                          ) : (
                            <span
                              className={`badge-status ${
                                targetUser.active
                                  ? "is-active"
                                  : "is-inactive"
                              }`}
                            >
                              {targetUser.active ? "ACTIVO" : "INACTIVO"}
                            </span>
                          )}
                        </td>

                        <td className="col-user-actions">
                          <div className="doc-actions user-actions">
                            {canEditRow && (
                              <button
                                type="button"
                                className="btn-main btn-secondary btn-xs"
                                onClick={() => openEditUser(targetUser)}
                                disabled={saving}
                              >
                                Editar
                              </button>
                            )}

                            {canReset && (
                              <button
                                type="button"
                                className="btn-main btn-ghost btn-xs"
                                onClick={() =>
                                  openResetPasswordDialog(targetUser)
                                }
                                disabled={saving}
                              >
                                Reset clave
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                className="btn-main btn-secondary-danger btn-xs"
                                onClick={() =>
                                  openDeleteUserDialog(targetUser)
                                }
                                disabled={saving}
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
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

      <ConfirmDialog
        open={confirmState.open}
        title={
          confirmState.action === "delete"
            ? "Eliminar usuario"
            : "Resetear contraseña"
        }
        message={
          confirmState.action === "delete"
            ? `¿Seguro que deseas eliminar al usuario "${
                confirmState.user?.name || "-"
              }" (${
                confirmState.user?.email || confirmState.user?.run
              })? Esta acción no se puede deshacer.`
            : `¿Seguro que deseas resetear la contraseña de ${
                confirmState.user?.name ||
                confirmState.user?.email ||
                "este usuario"
              }?`
        }
        confirmLabel={
          confirmState.action === "delete"
            ? "Sí, eliminar"
            : "Sí, resetear"
        }
        cancelLabel="Cancelar"
        confirmVariant={
          confirmState.action === "delete" ? "danger" : "primary"
        }
        loading={confirmState.loading}
        onCancel={closeConfirmDialog}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

export default UsersAdminView;