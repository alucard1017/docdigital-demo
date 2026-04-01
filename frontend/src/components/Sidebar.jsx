// src/components/Sidebar.jsx
import React from "react";

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
}) {
  const OWNER_ID = 7;
  const isOwner = user?.id === OWNER_ID;

  const showAdminSection = isOwner || isAnyAdmin;
  const isAdminGlobalOrOwner =
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN_GLOBAL" ||
      user.id === OWNER_ID);

  const totalDocs = Array.isArray(docs) ? docs.length : 0;
  const safePendientes = Number.isFinite(pendientes) ? pendientes : 0;

  const subtleText = "#9ca3af";

  const navItemBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: "0.82rem",
    fontWeight: 500,
    cursor: "pointer",
    color: subtleText,
    transition:
      "background-color 0.18s ease, color 0.18s ease, transform 0.08s ease",
    userSelect: "none",
  };

  const makeNavItemClass = (isActive) =>
    `nav-item${isActive ? " active" : ""}`;

  const renderNavItem = ({
    active = false,
    label,
    icon,
    title,
    onClick,
  }) => (
    <div
      className={makeNavItemClass(active)}
      style={navItemBaseStyle}
      onClick={onClick}
      title={title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
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
          }}
        />
        <div>
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
              color: subtleText,
            }}
          >
            Panel principal
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
          <div>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 3,
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: subtleText,
              }}
            >
              Sesión activa
            </div>
            <div style={{ fontWeight: 600 }}>{user?.name || "Usuario"}</div>
            <div
              style={{
                opacity: 0.8,
                fontSize: "0.7rem",
                color: subtleText,
              }}
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
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "999px",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 0 4px rgba(34,197,94,0.25)",
              }}
            />
            <span>{user?.role || "USER"}</span>
          </div>
        </div>
      </div>

      {/* Bandeja */}
      <h3 className="sidebar-section-label">Bandeja</h3>

      {renderNavItem({
        active: view === "list",
        icon: "📄",
        label: "Mis trámites",
        title: "Ver todos los trámites",
        onClick: () => setView("list"),
      })}

      {renderNavItem({
        active: view === "upload",
        icon: "📤",
        label: "Crear nuevo trámite",
        title: "Crear nuevo trámite de firma",
        onClick: () => setView("upload"),
      })}

      {/* Atajos */}
      <h3 className="sidebar-section-label">Atajos</h3>

      {renderNavItem({
        active: statusFilter === "ONLY_PENDIENTES",
        icon: "⏳",
        label: "Solo pendientes",
        title: "Mostrar solo documentos pendientes",
        onClick: () => setStatusFilter("ONLY_PENDIENTES"),
      })}

      {renderNavItem({
        active: statusFilter === "ONLY_FIRMADOS",
        icon: "✅",
        label: "Solo firmados",
        title: "Mostrar solo documentos firmados",
        onClick: () => setStatusFilter("ONLY_FIRMADOS"),
      })}

      {renderNavItem({
        active: statusFilter === "ONLY_RECHAZADOS",
        icon: "❌",
        label: "Solo rechazados",
        title: "Mostrar solo documentos rechazados",
        onClick: () => setStatusFilter("ONLY_RECHAZADOS"),
      })}

      {/* Reportes */}
      {showAdminSection && (
        <>
          <h3 className="sidebar-section-label">Reportes</h3>

          {renderNavItem({
            active: view === "dashboard",
            icon: "📊",
            label: "Dashboard",
            title: "Dashboard administrativo",
            onClick: () => setView("dashboard"),
          })}

          {renderNavItem({
            active: view === "email-metrics",
            icon: "📧",
            label: "Métricas de email",
            title: "Ver métricas de email",
            onClick: () => setView("email-metrics"),
          })}

          {renderNavItem({
            active: view === "company-analytics",
            icon: "📈",
            label: "Analytics empresa",
            title: "Analytics de la empresa",
            onClick: () => setView("company-analytics"),
          })}

          {renderNavItem({
            active: view === "templates",
            icon: "📋",
            label: "Plantillas",
            title: "Gestionar plantillas de documentos",
            onClick: () => setView("templates"),
          })}
        </>
      )}

      {/* Cuenta */}
      <h3 className="sidebar-section-label">Cuenta</h3>

      {renderNavItem({
        active: view === "pricing",
        icon: "💳",
        label: "Planes y facturación",
        title: "Ver planes y facturación",
        onClick: () => setView("pricing"),
      })}

      {renderNavItem({
        active: view === "profile",
        icon: "👤",
        label: "Mi perfil",
        title: "Editar tu perfil",
        onClick: () => setView("profile"),
      })}

      {/* Administración */}
      {showAdminSection && (
        <>
          <h3 className="sidebar-section-label">Administración</h3>

          {renderNavItem({
            active: view === "users",
            icon: "👥",
            label: "Usuarios",
            title: "Gestionar usuarios de la empresa",
            onClick: () => setView("users"),
          })}

          {renderNavItem({
            active: view === "reminders-config",
            icon: "🔔",
            label: "Recordatorios",
            title: "Configurar recordatorios automáticos",
            onClick: () => setView("reminders-config"),
          })}

          {isAdminGlobalOrOwner && (
            <>
              {renderNavItem({
                active: view === "companies",
                icon: "🏢",
                label: "Empresas",
                title: "Gestionar empresas",
                onClick: () => setView("companies"),
              })}

              {renderNavItem({
                active: view === "status",
                icon: "⚙️",
                label: "Estado sistema",
                title: "Estado del sistema",
                onClick: () => setView("status"),
              })}

              {renderNavItem({
                active: view === "audit-logs",
                icon: "📜",
                label: "Auditoría negocio",
                title: "Auditoría de negocio",
                onClick: () => setView("audit-logs"),
              })}

              {renderNavItem({
                active: view === "auth-logs",
                icon: "🔐",
                label: "Auth logs",
                title: "Logs de autenticación",
                onClick: () => setView("auth-logs"),
              })}
            </>
          )}
        </>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          marginBottom: 10,
          padding: 10,
          borderRadius: 12,
          background: "#020617",
          color: subtleText,
          fontSize: "0.7rem",
          border: "1px solid #1f2937",
          boxShadow: "0 10px 26px rgba(15,23,42,0.8)",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          Trámites totales:{" "}
          <strong style={{ color: "#e5e7eb" }}>{totalDocs}</strong>
        </div>
        <div>
          Pendientes hoy:{" "}
          <strong style={{ color: "#fbbf24" }}>{safePendientes}</strong>
        </div>
      </div>

      {renderNavItem({
        active: false,
        icon: "🚪",
        label: "Cerrar sesión",
        title: "Cerrar sesión",
        onClick: logout,
      })}
    </aside>
  );
}