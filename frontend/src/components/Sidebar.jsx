// src/components/Sidebar.jsx
import React, { useCallback, useMemo } from "react";
import "../styles/sidebar.css";
import {
  isAnyAdmin,
  isEffectiveGlobalAdmin,
  canViewDashboard,
  canViewEmailMetrics,
  canViewCompanyAnalytics,
  canManageUsers,
  canViewTemplates,
  canManageReminders,
  canManageCompanies,
  canManageSystemStatus,
  canViewAuditLogs,
} from "../utils/permissions";

function buildNavItemClass(active) {
  return `nav-item${active ? " active" : ""}`;
}

function SidebarSectionLabel({ children }) {
  return <h3 className="sidebar-section-label">{children}</h3>;
}

function getSocketUi(socketStatus) {
  const isConnected = socketStatus === "connected";
  const isReconnecting = socketStatus === "reconnecting";
  const isConnecting = socketStatus === "connecting";
  const isError =
    socketStatus === "error" || socketStatus === "disconnected";

  const label = isConnected
    ? "En línea"
    : isReconnecting
    ? "Reconectando…"
    : isConnecting
    ? "Conectando…"
    : "Sin conexión";

  const toneClass = isConnected
    ? "is-connected"
    : isReconnecting || isConnecting
    ? "is-warning"
    : "is-error";

  const title = isConnected
    ? "Conectado al servidor en tiempo real"
    : isReconnecting || isConnecting
    ? "Intentando reconectar al servidor en tiempo real"
    : "Conexión en tiempo real perdida";

  return {
    isConnected,
    isReconnecting,
    isConnecting,
    isError,
    label,
    toneClass,
    title,
  };
}

export function Sidebar({
  user,
  totalDocuments,
  totalPendientes,
  totalVisados,
  totalFirmados,
  totalRechazados,
  view,
  setView,
  logout,
  isAnyAdmin: isAnyAdminProp,
  socketStatus,
  socketLastError,
  socketCanRetry,
  onRetrySocket,
}) {
  // Por compatibilidad: si te pasan isAnyAdmin como prop, úsalo como fallback
  const anyAdmin = useMemo(
    () => (typeof isAnyAdminProp === "boolean"
      ? isAnyAdminProp
      : isAnyAdmin(user)),
    [isAnyAdminProp, user]
  );

  const isGlobalAdmin = useEffectiveGlobalAdmin(user);
  const canSeeDashboard = canViewDashboard(user);
  const canSeeEmailMetrics = canViewEmailMetrics(user);
  const canSeeCompanyAnalytics = canViewCompanyAnalytics(user);
  const canAdminUsers = canManageUsers(user);
  const canAdminTemplates = canViewTemplates(user);
  const canAdminReminders = canManageReminders(user);
  const canAdminCompanies = canManageCompanies(user);
  const canAdminSystemStatus = canManageSystemStatus(user);
  const canSeeAudit = canViewAuditLogs(user);

  const safeTotalDocs = Number.isFinite(totalDocuments) ? totalDocuments : 0;
  const safePendientes = Number.isFinite(totalPendientes)
    ? totalPendientes
    : 0;
  const safeVisados = Number.isFinite(totalVisados) ? totalVisados : 0;
  const safeFirmados = Number.isFinite(totalFirmados) ? totalFirmados : 0;
  const safeRechazados = Number.isFinite(totalRechazados)
    ? totalRechazados
    : 0;

  const displayRole = user?.role || "USER";
  const socketUi = getSocketUi(socketStatus);

  const handleKeyActivate = useCallback((e, onClick) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }, []);

  const handleChangeView = useCallback(
    (nextView) => {
      if (typeof setView === "function") {
        setView(nextView);
      }
    },
    [setView]
  );

  const renderNavItem = useCallback(
    ({
      active = false,
      label,
      icon,
      title,
      onClick,
      ariaCurrent = "false",
      badge = null,
    }) => (
      <div
        className={buildNavItemClass(active)}
        onClick={onClick}
        title={title}
        role="button"
        tabIndex={0}
        aria-current={active ? "page" : ariaCurrent}
        onKeyDown={(e) => handleKeyActivate(e, onClick)}
      >
        <span className="nav-item-icon" aria-hidden="true">
          {icon}
        </span>

        <span className="nav-item-label">{label}</span>

        {badge !== null && badge !== undefined && badge !== "" && (
          <span className="nav-item-badge">{badge}</span>
        )}
      </div>
    ),
    [handleKeyActivate]
  );

  return (
    <aside className="sidebar sidebar-root">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <div className="sidebar-brand-mark-inner" />
        </div>

        <div className="sidebar-brand-copy">
          <div className="sidebar-brand-title">VeriFirma</div>

          <div className="sidebar-brand-subtitle">
            <span>Panel principal</span>

            {socketStatus && (
              <>
                <span className="sidebar-brand-divider">•</span>

                <span
                  className={`sidebar-socket-status ${socketUi.toneClass}`}
                  title={socketUi.title}
                >
                  <span className="sidebar-socket-dot" />
                  <span className="sidebar-socket-label">
                    {socketUi.label}
                    {socketUi.isReconnecting && (
                      <span
                        aria-hidden="true"
                        className="sidebar-socket-spinner"
                      />
                    )}
                  </span>
                </span>
              </>
            )}
          </div>

          {socketUi.isError && socketLastError && (
            <div className="sidebar-socket-error">
              <span className="sidebar-socket-error-text">
                {socketLastError}
              </span>

              {socketCanRetry && typeof onRetrySocket === "function" && (
                <button
                  type="button"
                  onClick={onRetrySocket}
                  className="sidebar-socket-retry"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-user-card">
        <div className="sidebar-user-header">Sesión activa</div>

        <div className="sidebar-user-name" title={user?.name || "Usuario"}>
          {user?.name || "Usuario"}
        </div>

        <div
          className="sidebar-user-email"
          title={user?.email || "usuario@correo.com"}
        >
          {user?.email || "usuario@correo.com"}
        </div>
      </div>

      <div className="sidebar-role-badge-wrap">
        <span className="sidebar-role-badge" title={displayRole}>
          <span className="sidebar-role-dot" />
          <span className="sidebar-role-text">{displayRole}</span>
        </span>
      </div>

      <SidebarSectionLabel>Bandeja</SidebarSectionLabel>

      {renderNavItem({
        active: view === "list",
        icon: "📄",
        label: "Mis trámites",
        title: "Ver todos los trámites",
        onClick: () => handleChangeView("list"),
        badge: safeTotalDocs > 0 ? safeTotalDocs : null,
      })}

      {renderNavItem({
        active: view === "upload",
        icon: "📤",
        label: "Crear nuevo trámite",
        title: "Crear nuevo trámite de firma",
        onClick: () => handleChangeView("upload"),
      })}

      {isGlobalAdmin && (
        <>
          <SidebarSectionLabel>Reportes</SidebarSectionLabel>

          {canSeeDashboard &&
            renderNavItem({
              active: view === "dashboard",
              icon: "📊",
              label: "Dashboard",
              title: "Dashboard administrativo global",
              onClick: () => handleChangeView("dashboard"),
            })}

          {canSeeEmailMetrics &&
            renderNavItem({
              active: view === "email-metrics",
              icon: "📧",
              label: "Métricas de email",
              title: "Ver métricas globales de email",
              onClick: () => handleChangeView("email-metrics"),
            })}

          {canSeeCompanyAnalytics &&
            renderNavItem({
              active: view === "company-analytics",
              icon: "📈",
              label: "Analytics empresa",
              title: "Analytics global por empresa",
              onClick: () => handleChangeView("company-analytics"),
            })}
        </>
      )}

      {anyAdmin && (
        <>
          <SidebarSectionLabel>Administración</SidebarSectionLabel>

          {canAdminUsers &&
            renderNavItem({
              active: view === "users",
              icon: "👥",
              label: "Usuarios",
              title: "Gestionar usuarios de la empresa",
              onClick: () => handleChangeView("users"),
            })}

          {canAdminTemplates &&
            renderNavItem({
              active: view === "templates",
              icon: "📋",
              label: "Plantillas",
              title: "Gestionar plantillas de documentos",
              onClick: () => handleChangeView("templates"),
            })}

          {canAdminReminders &&
            renderNavItem({
              active: view === "reminders-config",
              icon: "🔔",
              label: "Recordatorios",
              title: "Configurar recordatorios automáticos",
              onClick: () => handleChangeView("reminders-config"),
            })}
        </>
      )}

      {isGlobalAdmin && (
        <>
          <SidebarSectionLabel>Administración global</SidebarSectionLabel>

          {canAdminCompanies &&
            renderNavItem({
              active: view === "companies",
              icon: "🏢",
              label: "Empresas",
              title: "Gestionar empresas",
              onClick: () => handleChangeView("companies"),
            })}

          {canAdminSystemStatus &&
            renderNavItem({
              active: view === "status",
              icon: "⚙️",
              label: "Estado sistema",
              title: "Estado del sistema",
              onClick: () => handleChangeView("status"),
            })}

          {canSeeAudit &&
            renderNavItem({
              active: view === "audit-logs",
              icon: "📜",
              label: "Auditoría negocio",
              title: "Auditoría de negocio",
              onClick: () => handleChangeView("audit-logs"),
            })}

          {canSeeAudit &&
            renderNavItem({
              active: view === "auth-logs",
              icon: "🔐",
              label: "Auth logs",
              title: "Logs de autenticación",
              onClick: () => handleChangeView("auth-logs"),
            })}
        </>
      )}

      <SidebarSectionLabel>Cuenta</SidebarSectionLabel>

      {renderNavItem({
        active: view === "pricing",
        icon: "💳",
        label: "Planes y facturación",
        title: "Ver planes y facturación",
        onClick: () => handleChangeView("pricing"),
      })}

      {renderNavItem({
        active: view === "profile",
        icon: "👤",
        label: "Mi perfil",
        title: "Editar tu perfil",
        onClick: () => handleChangeView("profile"),
      })}

      <div className="sidebar-metrics-card">
        <div className="sidebar-metric-row">
          <span>Trámites totales</span>
          <strong className="sidebar-metric-value">{safeTotalDocs}</strong>
        </div>

        <div className="sidebar-metric-row">
          <span>Pendientes hoy</span>
          <strong className="sidebar-metric-value is-warning">
            {safePendientes}
          </strong>
        </div>

        <div className="sidebar-metric-row">
          <span>Visados</span>
          <strong className="sidebar-metric-value">{safeVisados}</strong>
        </div>

        <div className="sidebar-metric-row">
          <span>Firmados</span>
          <strong className="sidebar-metric-value">{safeFirmados}</strong>
        </div>

        <div className="sidebar-metric-row">
          <span>Rechazados</span>
          <strong className="sidebar-metric-value">{safeRechazados}</strong>
        </div>

        <div className="sidebar-metrics-divider" />

        <div className="sidebar-metrics-text">
          Gestiona envíos, seguimiento y firma desde una sola bandeja.
        </div>
      </div>

      {renderNavItem({
        active: false,
        icon: "🚪",
        label: "Cerrar sesión",
        title: "Cerrar sesión",
        onClick: logout,
        ariaCurrent: "false",
      })}
    </aside>
  );
}

// Pequeño hook interno para recalcular solo una vez
function useEffectiveGlobalAdmin(user) {
  return useMemo(() => isEffectiveGlobalAdmin(user), [user]);
}