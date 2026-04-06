// src/components/Sidebar.jsx
import React, { useCallback, useMemo } from "react";

const OWNER_ID = 7;
const SUBTLE_TEXT = "#9ca3af";

function buildNavItemClass(active) {
  return `nav-item${active ? " active" : ""}`;
}

function SidebarSectionLabel({ children }) {
  return <h3 className="sidebar-section-label">{children}</h3>;
}

export function Sidebar({
  user,
  docs,
  pendientes,
  view,
  setView,
  statusFilter,
  setStatusFilter,
  logout,
  isAnyAdmin,
  socketConnected,
}) {
  const isOwner = user?.id === OWNER_ID;

  const showAdminSection = isOwner || isAnyAdmin;
  const isAdminGlobalOrOwner =
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN_GLOBAL" ||
      user.id === OWNER_ID);

  const totalDocs = Array.isArray(docs) ? docs.length : 0;
  const safePendientes = Number.isFinite(pendientes) ? pendientes : 0;
  const displayRole = user?.role || "USER";

  const navItemBaseStyle = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 10,
      fontSize: "0.82rem",
      fontWeight: 500,
      cursor: "pointer",
      color: SUBTLE_TEXT,
      transition:
        "background-color 0.18s ease, color 0.18s ease, transform 0.08s ease",
      userSelect: "none",
    }),
    []
  );

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

  const handleChangeStatus = useCallback(
    (nextStatus) => {
      if (typeof setStatusFilter === "function") {
        setStatusFilter(nextStatus);
      }
    },
    [setStatusFilter]
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
        style={navItemBaseStyle}
        onClick={onClick}
        title={title}
        role="button"
        tabIndex={0}
        aria-current={active ? "page" : ariaCurrent}
        onKeyDown={(e) => handleKeyActivate(e, onClick)}
      >
        <span
          aria-hidden="true"
          style={{
            width: 18,
            display: "inline-flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>

        {badge !== null && badge !== undefined && badge !== "" && (
          <span
            style={{
              marginLeft: "auto",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: "0.68rem",
              fontWeight: 700,
              background: "rgba(148,163,184,0.12)",
              border: "1px solid rgba(148,163,184,0.18)",
              color: "#e5e7eb",
              lineHeight: 1.2,
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
      </div>
    ),
    [handleKeyActivate, navItemBaseStyle]
  );

  return (
    <aside className="sidebar sidebar-root">
      {/* Branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background:
              "conic-gradient(from 180deg at 50% 50%, #4f46e5 0deg, #0ea5e9 90deg, #22c55e 210deg, #4f46e5 360deg)",
            boxShadow: "0 8px 25px rgba(15,23,42,0.9)",
            position: "relative",
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              position: "absolute",
              inset: 1,
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              letterSpacing: "0.12em",
              fontSize: "0.78rem",
              textTransform: "uppercase",
              color: "#e5e7eb",
            }}
          >
            VeriFirma
          </div>

          <div
            style={{
              fontSize: "0.74rem",
              color: SUBTLE_TEXT,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Panel principal</span>

            {typeof socketConnected === "boolean" && (
              <>
                <span style={{ opacity: 0.45 }}>•</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    color: socketConnected ? "#86efac" : "#fca5a5",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "999px",
                      background: socketConnected ? "#22c55e" : "#ef4444",
                      boxShadow: socketConnected
                        ? "0 0 0 4px rgba(34,197,94,0.18)"
                        : "0 0 0 4px rgba(239,68,68,0.16)",
                    }}
                  />
                  {socketConnected ? "En línea" : "Sin conexión"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Usuario */}
      <div
        style={{
          marginBottom: 18,
          padding: 10,
          borderRadius: 12,
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.30), transparent 55%), #020617",
          border: "1px solid rgba(37,99,235,0.5)",
          color: "#e5e7eb",
          fontSize: "0.7rem",
          boxShadow: "0 14px 32px rgba(15,23,42,0.9)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 3,
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: SUBTLE_TEXT,
              }}
            >
              Sesión activa
            </div>

            <div
              style={{
                fontWeight: 600,
                fontSize: "0.84rem",
                color: "#f8fafc",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user?.name || "Usuario"}
            >
              {user?.name || "Usuario"}
            </div>

            <div
              style={{
                opacity: 0.82,
                fontSize: "0.7rem",
                color: SUBTLE_TEXT,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user?.email || "usuario@correo.com"}
            >
              {user?.email || "usuario@correo.com"}
            </div>
          </div>

          <div
            style={{
              paddingInline: 10,
              paddingBlock: 3,
              borderRadius: 999,
              background: "linear-gradient(135deg, #111827, #020617)",
              border: "1px solid #1f2937",
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              maxWidth: 120,
            }}
            title={displayRole}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "999px",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 0 4px rgba(34,197,94,0.25)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayRole}
            </span>
          </div>
        </div>
      </div>

      {/* Bandeja */}
      <SidebarSectionLabel>Bandeja</SidebarSectionLabel>

      {renderNavItem({
        active: view === "list",
        icon: "📄",
        label: "Mis trámites",
        title: "Ver todos los trámites",
        onClick: () => handleChangeView("list"),
        badge: totalDocs > 0 ? totalDocs : null,
      })}

      {renderNavItem({
        active: view === "upload",
        icon: "📤",
        label: "Crear nuevo trámite",
        title: "Crear nuevo trámite de firma",
        onClick: () => handleChangeView("upload"),
      })}

      {/* Atajos */}
      <SidebarSectionLabel>Atajos</SidebarSectionLabel>

      {renderNavItem({
        active: statusFilter === "ONLY_PENDIENTES",
        icon: "⏳",
        label: "Solo pendientes",
        title: "Mostrar solo documentos pendientes",
        onClick: () => handleChangeStatus("ONLY_PENDIENTES"),
        badge: safePendientes > 0 ? safePendientes : null,
      })}

      {renderNavItem({
        active: statusFilter === "ONLY_FIRMADOS",
        icon: "✅",
        label: "Solo firmados",
        title: "Mostrar solo documentos firmados",
        onClick: () => handleChangeStatus("ONLY_FIRMADOS"),
      })}

      {renderNavItem({
        active: statusFilter === "ONLY_RECHAZADOS",
        icon: "❌",
        label: "Solo rechazados",
        title: "Mostrar solo documentos rechazados",
        onClick: () => handleChangeStatus("ONLY_RECHAZADOS"),
      })}

      {/* Reportes */}
      {showAdminSection && (
        <>
          <SidebarSectionLabel>Reportes</SidebarSectionLabel>

          {renderNavItem({
            active: view === "dashboard",
            icon: "📊",
            label: "Dashboard",
            title: "Dashboard administrativo",
            onClick: () => handleChangeView("dashboard"),
          })}

          {renderNavItem({
            active: view === "email-metrics",
            icon: "📧",
            label: "Métricas de email",
            title: "Ver métricas de email",
            onClick: () => handleChangeView("email-metrics"),
          })}

          {renderNavItem({
            active: view === "company-analytics",
            icon: "📈",
            label: "Analytics empresa",
            title: "Analytics de la empresa",
            onClick: () => handleChangeView("company-analytics"),
          })}

          {renderNavItem({
            active: view === "templates",
            icon: "📋",
            label: "Plantillas",
            title: "Gestionar plantillas de documentos",
            onClick: () => handleChangeView("templates"),
          })}
        </>
      )}

      {/* Cuenta */}
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

      {/* Administración */}
      {showAdminSection && (
        <>
          <SidebarSectionLabel>Administración</SidebarSectionLabel>

          {renderNavItem({
            active: view === "users",
            icon: "👥",
            label: "Usuarios",
            title: "Gestionar usuarios de la empresa",
            onClick: () => handleChangeView("users"),
          })}

          {renderNavItem({
            active: view === "reminders-config",
            icon: "🔔",
            label: "Recordatorios",
            title: "Configurar recordatorios automáticos",
            onClick: () => handleChangeView("reminders-config"),
          })}

          {isAdminGlobalOrOwner && (
            <>
              {renderNavItem({
                active: view === "companies",
                icon: "🏢",
                label: "Empresas",
                title: "Gestionar empresas",
                onClick: () => handleChangeView("companies"),
              })}

              {renderNavItem({
                active: view === "status",
                icon: "⚙️",
                label: "Estado sistema",
                title: "Estado del sistema",
                onClick: () => handleChangeView("status"),
              })}

              {renderNavItem({
                active: view === "audit-logs",
                icon: "📜",
                label: "Auditoría negocio",
                title: "Auditoría de negocio",
                onClick: () => handleChangeView("audit-logs"),
              })}

              {renderNavItem({
                active: view === "auth-logs",
                icon: "🔐",
                label: "Auth logs",
                title: "Logs de autenticación",
                onClick: () => handleChangeView("auth-logs"),
              })}
            </>
          )}
        </>
      )}

      {/* Footer métricas rápidas */}
      <div
        style={{
          marginTop: "auto",
          marginBottom: 10,
          padding: 10,
          borderRadius: 12,
          background: "#020617",
          color: SUBTLE_TEXT,
          fontSize: "0.7rem",
          border: "1px solid #1f2937",
          boxShadow: "0 10px 26px rgba(15,23,42,0.8)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span>Trámites totales</span>
          <strong style={{ color: "#e5e7eb" }}>{totalDocs}</strong>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span>Pendientes hoy</span>
          <strong style={{ color: "#fbbf24" }}>{safePendientes}</strong>
        </div>

        <div
          style={{
            height: 1,
            background: "rgba(148,163,184,0.12)",
            marginBlock: 8,
          }}
        />

        <div
          style={{
            fontSize: "0.68rem",
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
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