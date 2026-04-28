import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

export default function Sidebar({
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
  const { t } = useTranslation();

  const anyAdmin = useMemo(() => {
    if (typeof isAnyAdminProp === "boolean") return isAnyAdminProp;
    return isAnyAdmin(user);
  }, [isAnyAdminProp, user]);

  const isGlobalAdmin = useMemo(() => isEffectiveGlobalAdmin(user), [user]);

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

  const socketUi = useMemo(() => {
    const normalized = String(socketStatus || "").toLowerCase();

    const isConnected = normalized === "connected";
    const isReconnecting = normalized === "reconnecting";
    const isConnecting = normalized === "connecting";
    const isErrorLike =
      normalized === "error" || normalized === "disconnected";

    return {
      isConnected,
      isReconnecting,
      isConnecting,
      isError: isErrorLike,
      label: isConnected
        ? t("sidebar.socket.online", "En línea")
        : isReconnecting
        ? t("sidebar.socket.reconnecting", "Reconectando…")
        : isConnecting
        ? t("sidebar.socket.connecting", "Conectando…")
        : t("sidebar.socket.degraded", "Modo degradado"),
      toneClass: isConnected
        ? "is-connected"
        : isReconnecting || isConnecting
        ? "is-warning"
        : "is-error",
      title: isConnected
        ? t(
            "sidebar.socket.connectedTitle",
            "Conectado al servidor en tiempo real."
          )
        : isReconnecting || isConnecting
        ? t(
            "sidebar.socket.reconnectingTitle",
            "Intentando reconectar al servidor en tiempo real."
          )
        : t(
            "sidebar.socket.errorTitle",
            "No pudimos mantener la conexión en tiempo real. La aplicación sigue funcionando, pero algunas actualizaciones pueden tardar unos segundos."
          ),
      inlineMessage: isConnected || !socketLastError ? null : socketLastError,
    };
  }, [socketStatus, socketLastError, t]);

  const handleKeyActivate = useCallback((event, onClick) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }, []);

  const handleChangeView = useCallback(
    (nextView) => {
      if (typeof setView === "function") setView(nextView);
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

  const inboxItems = [
    {
      show: true,
      active: view === "list",
      icon: <FileText size={18} />,
      label: t("sidebar.items.myDocuments", "Mis trámites"),
      title: t("sidebar.items.myDocumentsTitle", "Ver todos los trámites"),
      onClick: () => handleChangeView("list"),
      badge: safeTotalDocs > 0 ? safeTotalDocs : null,
    },
    {
      show: true,
      active: view === "upload",
      icon: <Upload size={18} />,
      label: t("sidebar.items.newProcedure", "Crear nuevo trámite"),
      title: t(
        "sidebar.items.newProcedureTitle",
        "Crear nuevo trámite de firma"
      ),
      onClick: () => handleChangeView("upload"),
    },
  ];

  const reportItems = [
    {
      show: isGlobalAdmin && canSeeDashboard,
      active: view === "dashboard",
      icon: <LayoutDashboard size={18} />,
      label: t("sidebar.items.dashboard", "Dashboard"),
      title: t(
        "sidebar.items.dashboardTitle",
        "Dashboard administrativo global"
      ),
      onClick: () => handleChangeView("dashboard"),
    },
    {
      show: isGlobalAdmin && canSeeEmailMetrics,
      active: view === "email-metrics",
      icon: <Mail size={18} />,
      label: t("sidebar.items.emailMetrics", "Métricas de email"),
      title: t(
        "sidebar.items.emailMetricsTitle",
        "Ver métricas globales de email"
      ),
      onClick: () => handleChangeView("email-metrics"),
    },
    {
      show: isGlobalAdmin && canSeeCompanyAnalytics,
      active: view === "company-analytics",
      icon: <BarChart3 size={18} />,
      label: t("sidebar.items.companyAnalytics", "Analytics empresa"),
      title: t(
        "sidebar.items.companyAnalyticsTitle",
        "Analytics global por empresa"
      ),
      onClick: () => handleChangeView("company-analytics"),
    },
  ];

  const adminItems = [
    {
      show: anyAdmin && canAdminUsers,
      active: view === "users",
      icon: <Users size={18} />,
      label: t("sidebar.items.users", "Usuarios"),
      title: t("sidebar.items.usersTitle", "Gestionar usuarios de la empresa"),
      onClick: () => handleChangeView("users"),
    },
    {
      show: anyAdmin && canAdminTemplates,
      active: view === "templates",
      icon: <FileStack size={18} />,
      label: t("sidebar.items.templates", "Plantillas"),
      title: t(
        "sidebar.items.templatesTitle",
        "Gestionar plantillas de documentos"
      ),
      onClick: () => handleChangeView("templates"),
    },
    {
      show: anyAdmin && canAdminReminders,
      active: view === "reminders-config",
      icon: <Bell size={18} />,
      label: t("sidebar.items.reminders", "Recordatorios"),
      title: t(
        "sidebar.items.remindersTitle",
        "Configurar recordatorios automáticos"
      ),
      onClick: () => handleChangeView("reminders-config"),
    },
  ];

  const globalAdminItems = [
    {
      show: isGlobalAdmin && canAdminCompanies,
      active: view === "companies",
      icon: <Building2 size={18} />,
      label: t("sidebar.items.companies", "Empresas"),
      title: t("sidebar.items.companiesTitle", "Gestionar empresas"),
      onClick: () => handleChangeView("companies"),
    },
    {
      show: isGlobalAdmin && canAdminSystemStatus,
      active: view === "status",
      icon: <Activity size={18} />,
      label: t("sidebar.items.systemStatus", "Estado sistema"),
      title: t("sidebar.items.systemStatusTitle", "Estado del sistema"),
      onClick: () => handleChangeView("status"),
    },
    {
      show: isGlobalAdmin && canSeeAudit,
      active: view === "audit-logs",
      icon: <ScrollText size={18} />,
      label: t("sidebar.items.businessAudit", "Auditoría negocio"),
      title: t(
        "sidebar.items.businessAuditTitle",
        "Auditoría de negocio"
      ),
      onClick: () => handleChangeView("audit-logs"),
    },
    {
      show: isGlobalAdmin && canSeeAudit,
      active: view === "auth-logs",
      icon: <Shield size={18} />,
      label: t("sidebar.items.authLogs", "Auth logs"),
      title: t("sidebar.items.authLogsTitle", "Logs de autenticación"),
      onClick: () => handleChangeView("auth-logs"),
    },
  ];

  const accountItems = [
    {
      show: true,
      active: view === "pricing",
      icon: <CreditCard size={18} />,
      label: t("sidebar.items.billing", "Planes y facturación"),
      title: t("sidebar.items.billingTitle", "Ver planes y facturación"),
      onClick: () => handleChangeView("pricing"),
    },
    {
      show: true,
      active: view === "profile",
      icon: <UserCircle2 size={18} />,
      label: t("sidebar.items.profile", "Mi perfil"),
      title: t("sidebar.items.profileTitle", "Editar tu perfil"),
      onClick: () => handleChangeView("profile"),
    },
  ];

  return (
    <aside className="sidebar sidebar-root">
      <div className="sidebar-brand-card">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">
            <div className="sidebar-brand-mark-inner" />
          </div>

          <div className="sidebar-brand-copy">
            <div className="sidebar-brand-title">
              {t("sidebar.brand", "VeriFirma")}
            </div>

            <div className="sidebar-brand-subtitle">
              <span>{t("sidebar.mainPanel", "Panel principal")}</span>

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
          </div>
        </div>

        <div className="sidebar-user-card">
          <div className="sidebar-user-header">
            {t("sidebar.activeSession", "Sesión activa")}
          </div>

          <div
            className="sidebar-user-name"
            title={user?.name || t("sidebar.defaultUser", "Usuario")}
          >
            {user?.name || t("sidebar.defaultUser", "Usuario")}
          </div>

          <div
            className="sidebar-user-email"
            title={user?.email || "usuario@correo.com"}
          >
            {user?.email || "usuario@correo.com"}
          </div>

          <div className="sidebar-role-badge-wrap">
            <span className="sidebar-role-badge" title={displayRole}>
              <span className="sidebar-role-dot" />
              <span className="sidebar-role-text">{displayRole}</span>
            </span>
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
                  {t("sidebar.retry", "Reintentar")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sidebar-nav-wrap">
        <SidebarSectionLabel>
          {t("sidebar.sections.inbox", "Bandeja")}
        </SidebarSectionLabel>
        {inboxItems.filter((item) => item.show).map(renderNavItem)}

        {reportItems.some((item) => item.show) ? (
          <>
            <SidebarSectionLabel>
              {t("sidebar.sections.reports", "Reportes")}
            </SidebarSectionLabel>
            {reportItems.filter((item) => item.show).map(renderNavItem)}
          </>
        ) : null}

        {adminItems.some((item) => item.show) ? (
          <>
            <SidebarSectionLabel>
              {t("sidebar.sections.admin", "Administración")}
            </SidebarSectionLabel>
            {adminItems.filter((item) => item.show).map(renderNavItem)}
          </>
        ) : null}

        {globalAdminItems.some((item) => item.show) ? (
          <>
            <SidebarSectionLabel>
              {t("sidebar.sections.globalAdmin", "Administración global")}
            </SidebarSectionLabel>
            {globalAdminItems.filter((item) => item.show).map(renderNavItem)}
          </>
        ) : null}

        <SidebarSectionLabel>
          {t("sidebar.sections.account", "Cuenta")}
        </SidebarSectionLabel>
        {accountItems.filter((item) => item.show).map(renderNavItem)}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-metrics-card">
          <div className="sidebar-metric-row">
            <span>{t("sidebar.metrics.total", "Trámites totales")}</span>
            <strong className="sidebar-metric-value">{safeTotalDocs}</strong>
          </div>

          <div className="sidebar-metric-row">
            <span>{t("sidebar.metrics.pendingToday", "Pendientes hoy")}</span>
            <strong className="sidebar-metric-value is-warning">
              {safePendientes}
            </strong>
          </div>

          <div className="sidebar-metric-row">
            <span>{t("sidebar.metrics.visas", "Visados")}</span>
            <strong className="sidebar-metric-value">{safeVisados}</strong>
          </div>

          <div className="sidebar-metric-row">
            <span>{t("sidebar.metrics.signed", "Firmados")}</span>
            <strong className="sidebar-metric-value">{safeFirmados}</strong>
          </div>

          <div className="sidebar-metric-row">
            <span>{t("sidebar.metrics.rejected", "Rechazados")}</span>
            <strong className="sidebar-metric-value">{safeRechazados}</strong>
          </div>

          <div className="sidebar-metrics-divider" />

          <div className="sidebar-metrics-text">
            {t(
              "sidebar.metrics.caption",
              "Gestiona envíos, seguimiento y firma desde una sola bandeja."
            )}
          </div>
        </div>

        {renderNavItem({
          active: false,
          icon: <LogOut size={18} />,
          label: t("sidebar.logout", "Cerrar sesión"),
          title: t("sidebar.logout", "Cerrar sesión"),
          onClick: logout,
          ariaCurrent: "false",
        })}
      </div>
    </aside>
  );
}