// src/components/Sidebar.jsx
import React, { useCallback, useMemo } from "react";
import {
  FileText,
  Upload,
  LayoutDashboard,
  Mail,
  BarChart3,
  Users,
  FileStack,
  Bell,
  Building2,
  Activity,
  ScrollText,
  Shield,
  CreditCard,
  UserCircle2,
  LogOut,
  RefreshCw,
} from "lucide-react";
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

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function getSocketUi(socketStatus, socketLastError) {
  const normalized = String(socketStatus || "").toLowerCase();

  const isConnected = normalized === "connected";
  const isReconnecting = normalized === "reconnecting";
  const isConnecting = normalized === "connecting";
  const isErrorLike =
    normalized === "error" || normalized === "disconnected";

  const label = isConnected
    ? "En línea"
    : isReconnecting
    ? "Reconectando…"
    : isConnecting
    ? "Conectando…"
    : "Modo degradado";

  const toneClass = isConnected
    ? "is-connected"
    : isReconnecting || isConnecting
    ? "is-warning"
    : "is-error";

  const title = isConnected
    ? "Conectado al servidor en tiempo real."
    : isReconnecting || isConnecting
    ? "Intentando reconectar al servidor en tiempo real."
    : "No pudimos mantener la conexión en tiempo real. La aplicación sigue funcionando, pero algunas actualizaciones pueden tardar unos segundos.";

  const inlineMessage =
    isConnected || !socketLastError ? null : socketLastError;

  return {
    isConnected,
    isReconnecting,
    isConnecting,
    isError: isErrorLike,
    label,
    toneClass,
    title,
    inlineMessage,
  };
}

function useEffectiveGlobalAdmin(user) {
  return useMemo(() => isEffectiveGlobalAdmin(user), [user]);
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
  const anyAdmin = useMemo(() => {
    if (typeof isAnyAdminProp === "boolean") {
      return isAnyAdminProp;
    }
    return isAnyAdmin(user);
  }, [isAnyAdminProp, user]);

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

  const safeTotalDocs = safeNumber(totalDocuments);
  const safePendientes = safeNumber(totalPendientes);
  const safeVisados = safeNumber(totalVisados);
  const safeFirmados = safeNumber(totalFirmados);
  const safeRechazados = safeNumber(totalRechazados);

  const displayRole = user?.role || "USER";

  const socketUi = useMemo(
    () => getSocketUi(socketStatus, socketLastError),
    [socketStatus, socketLastError]
  );

  const handleKeyActivate = useCallback((event, onClick) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
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
        onKeyDown={(event) => handleKeyActivate(event, onClick)}
      >
        <span className="nav-item-icon" aria-hidden="true">
          {icon}
        </span>

        <span className="nav-item-label">{label}</span>

        {badge !== null && badge !== undefined && badge !== "" ? (
          <span className="nav-item-badge">{badge}</span>
        ) : null}
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

            {socketStatus ? (
              <>
                <span className="sidebar-brand-divider">•</span>

                <span
                  className={`sidebar-socket-status ${socketUi.toneClass}`}
                  title={socketUi.title}
                >
                  <span className="sidebar-socket-dot" />
                  <span className="sidebar-socket-label">
                    {socketUi.label}
                    {socketUi.isReconnecting ? (
                      <RefreshCw
                        size={12}
                        className="sidebar-socket-spinner"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                </span>
              </>
            ) : null}
          </div>

          {socketUi.isError && socketUi.inlineMessage ? (
            <div className="sidebar-socket-error">
              <span className="sidebar-socket-error-text">
                {socketUi.inlineMessage}
              </span>

              {socketCanRetry && typeof onRetrySocket === "function" ? (
                <button
                  type="button"
                  onClick={onRetrySocket}
                  className="sidebar-socket-retry"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}
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
        icon: <FileText size={18} />,
        label: "Mis trámites",
        title: "Ver todos los trámites",
        onClick: () => handleChangeView("list"),
        badge: safeTotalDocs > 0 ? safeTotalDocs : null,
      })}

      {renderNavItem({
        active: view === "upload",
        icon: <Upload size={18} />,
        label: "Crear nuevo trámite",
        title: "Crear nuevo trámite de firma",
        onClick: () => handleChangeView("upload"),
      })}

      {isGlobalAdmin ? (
        <>
          <SidebarSectionLabel>Reportes</SidebarSectionLabel>

          {canSeeDashboard
            ? renderNavItem({
                active: view === "dashboard",
                icon: <LayoutDashboard size={18} />,
                label: "Dashboard",
                title: "Dashboard administrativo global",
                onClick: () => handleChangeView("dashboard"),
              })
            : null}

          {canSeeEmailMetrics
            ? renderNavItem({
                active: view === "email-metrics",
                icon: <Mail size={18} />,
                label: "Métricas de email",
                title: "Ver métricas globales de email",
                onClick: () => handleChangeView("email-metrics"),
              })
            : null}

          {canSeeCompanyAnalytics
            ? renderNavItem({
                active: view === "company-analytics",
                icon: <BarChart3 size={18} />,
                label: "Analytics empresa",
                title: "Analytics global por empresa",
                onClick: () => handleChangeView("company-analytics"),
              })
            : null}
        </>
      ) : null}

      {anyAdmin ? (
        <>
          <SidebarSectionLabel>Administración</SidebarSectionLabel>

          {canAdminUsers
            ? renderNavItem({
                active: view === "users",
                icon: <Users size={18} />,
                label: "Usuarios",
                title: "Gestionar usuarios de la empresa",
                onClick: () => handleChangeView("users"),
              })
            : null}

          {canAdminTemplates
            ? renderNavItem({
                active: view === "templates",
                icon: <FileStack size={18} />,
                label: "Plantillas",
                title: "Gestionar plantillas de documentos",
                onClick: () => handleChangeView("templates"),
              })
            : null}

          {canAdminReminders
            ? renderNavItem({
                active: view === "reminders-config",
                icon: <Bell size={18} />,
                label: "Recordatorios",
                title: "Configurar recordatorios automáticos",
                onClick: () => handleChangeView("reminders-config"),
              })
            : null}
        </>
      ) : null}

      {isGlobalAdmin ? (
        <>
          <SidebarSectionLabel>Administración global</SidebarSectionLabel>

          {canAdminCompanies
            ? renderNavItem({
                active: view === "companies",
                icon: <Building2 size={18} />,
                label: "Empresas",
                title: "Gestionar empresas",
                onClick: () => handleChangeView("companies"),
              })
            : null}

          {canAdminSystemStatus
            ? renderNavItem({
                active: view === "status",
                icon: <Activity size={18} />,
                label: "Estado sistema",
                title: "Estado del sistema",
                onClick: () => handleChangeView("status"),
              })
            : null}

          {canSeeAudit
            ? renderNavItem({
                active: view === "audit-logs",
                icon: <ScrollText size={18} />,
                label: "Auditoría negocio",
                title: "Auditoría de negocio",
                onClick: () => handleChangeView("audit-logs"),
              })
            : null}

          {canSeeAudit
            ? renderNavItem({
                active: view === "auth-logs",
                icon: <Shield size={18} />,
                label: "Auth logs",
                title: "Logs de autenticación",
                onClick: () => handleChangeView("auth-logs"),
              })
            : null}
        </>
      ) : null}

      <SidebarSectionLabel>Cuenta</SidebarSectionLabel>

      {renderNavItem({
        active: view === "pricing",
        icon: <CreditCard size={18} />,
        label: "Planes y facturación",
        title: "Ver planes y facturación",
        onClick: () => handleChangeView("pricing"),
      })}

      {renderNavItem({
        active: view === "profile",
        icon: <UserCircle2 size={18} />,
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
        icon: <LogOut size={18} />,
        label: "Cerrar sesión",
        title: "Cerrar sesión",
        onClick: logout,
        ariaCurrent: "false",
      })}
    </aside>
  );
}