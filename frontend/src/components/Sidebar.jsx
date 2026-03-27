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

  const handleChangeView = (nextView) => {
    setView(nextView);
  };

  const handleStatusFilter = (filter) => {
    setStatusFilter(filter);
  };

  const showAdminSection = isOwner || isAnyAdmin;
  const isAdminGlobalOrOwner =
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN_GLOBAL" ||
      user.id === OWNER_ID);

  const totalDocs = docs.length || 0;

  const subtleText = "#9ca3af";

  const navItemBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 10,
    fontSize: "0.8rem",
    fontWeight: 500,
    cursor: "pointer",
    color: subtleText,
    transition: "background-color 0.18s ease, color 0.18s ease, transform 0.08s ease",
  };

  const makeNavItemClass = (isActive) =>
    `nav-item${isActive ? " active" : ""}`;

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
            <div style={{ fontWeight: 600 }}>
              {user?.name || "Usuario"}
            </div>
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
              background:
                "linear-gradient(135deg, #111827, #020617)",
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

      <div
        className={makeNavItemClass(view === "list")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("list")}
        title="Ver todos los trámites"
      >
        <span>📄</span>
        <span>Mis trámites</span>
      </div>

      <div
        className={makeNavItemClass(view === "upload")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("upload")}
        title="Crear nuevo trámite de firma"
      >
        <span>📤</span>
        <span>Crear nuevo trámite</span>
      </div>

      {/* Atajos */}
      <h3 className="sidebar-section-label">Atajos</h3>

      <div
        className={makeNavItemClass(statusFilter === "ONLY_PENDIENTES")}
        style={navItemBaseStyle}
        onClick={() => handleStatusFilter("ONLY_PENDIENTES")}
        title="Mostrar solo documentos pendientes"
      >
        <span>⏳</span>
        <span>Solo pendientes</span>
      </div>

      <div
        className={makeNavItemClass(statusFilter === "ONLY_FIRMADOS")}
        style={navItemBaseStyle}
        onClick={() => handleStatusFilter("ONLY_FIRMADOS")}
        title="Mostrar solo documentos firmados"
      >
        <span>✅</span>
        <span>Solo firmados</span>
      </div>

      <div
        className={makeNavItemClass(statusFilter === "ONLY_RECHAZADOS")}
        style={navItemBaseStyle}
        onClick={() => handleStatusFilter("ONLY_RECHAZADOS")}
        title="Mostrar solo documentos rechazados"
      >
        <span>❌</span>
        <span>Solo rechazados</span>
      </div>

      <div
        className={makeNavItemClass(view === "verification")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("verification")}
        title="Verificar estado público de documentos"
      >
        <span>🔍</span>
        <span>Verificar documento</span>
      </div>

      {/* Reportes */}
      <h3 className="sidebar-section-label">Reportes</h3>

      <div
        className={makeNavItemClass(view === "email-metrics")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("email-metrics")}
        title="Ver métricas de email"
      >
        <span>📊</span>
        <span>Analytics</span>
      </div>

      <div
        className={makeNavItemClass(view === "company-analytics")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("company-analytics")}
        title="Analytics de la empresa"
      >
        <span>📈</span>
        <span>Analytics Empresa</span>
      </div>

      <div
        className={makeNavItemClass(view === "pricing")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("pricing")}
        title="Ver planes y facturación"
      >
        <span>💳</span>
        <span>Planes y facturación</span>
      </div>

      <div
        className={makeNavItemClass(view === "templates")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("templates")}
        title="Gestionar plantillas de documentos"
      >
        <span>📋</span>
        <span>Plantillas</span>
      </div>

      <div
        className={makeNavItemClass(view === "profile")}
        style={navItemBaseStyle}
        onClick={() => handleChangeView("profile")}
        title="Editar tu perfil"
      >
        <span>👤</span>
        <span>Mi perfil</span>
      </div>

      {/* Administración */}
      {showAdminSection && (
        <>
          <h3 className="sidebar-section-label">Administración</h3>

          <div
            className={makeNavItemClass(view === "users")}
            style={navItemBaseStyle}
            onClick={() => handleChangeView("users")}
            title="Gestionar usuarios de la empresa"
          >
            <span>👥</span>
            <span>Usuarios</span>
          </div>

          <div
            className={makeNavItemClass(view === "reminders-config")}
            style={navItemBaseStyle}
            onClick={() => handleChangeView("reminders-config")}
            title="Configurar recordatorios automáticos"
          >
            <span>🔔</span>
            <span>Recordatorios</span>
          </div>

          <div
            className={makeNavItemClass(view === "dashboard")}
            style={navItemBaseStyle}
            onClick={() => handleChangeView("dashboard")}
            title="Dashboard administrativo"
          >
            <span>📊</span>
            <span>Dashboard</span>
          </div>

          {isAdminGlobalOrOwner && (
            <>
              <div
                className={makeNavItemClass(view === "companies")}
                style={navItemBaseStyle}
                onClick={() => handleChangeView("companies")}
                title="Gestionar empresas"
              >
                <span>🏢</span>
                <span>Empresas</span>
              </div>

              <div
                className={makeNavItemClass(view === "status")}
                style={navItemBaseStyle}
                onClick={() => handleChangeView("status")}
                title="Estado del sistema"
              >
                <span>⚙️</span>
                <span>Estado Sistema</span>
              </div>

              <div
                className={makeNavItemClass(view === "audit-logs")}
                style={navItemBaseStyle}
                onClick={() => handleChangeView("audit-logs")}
                title="Auditoría de negocio"
              >
                <span>📜</span>
                <span>Auditoría (negocio)</span>
              </div>

              <div
                className={makeNavItemClass(view === "auth-logs")}
                style={navItemBaseStyle}
                onClick={() => handleChangeView("auth-logs")}
                title="Logs de autenticación"
              >
                <span>🔐</span>
                <span>Auth logs</span>
              </div>
            </>
          )}
        </>
      )}

      {/* Footer: resumen + logout */}
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
          <strong style={{ color: "#fbbf24" }}>{pendientes}</strong>
        </div>
      </div>

      <div
        className="nav-item"
        style={{
          ...navItemBaseStyle,
          marginTop: 0,
          color: "#fecaca",
        }}
        onClick={logout}
        title="Cerrar sesión"
      >
        <span>🚪</span>
        <span>Cerrar sesión</span>
      </div>
    </aside>
  );
}