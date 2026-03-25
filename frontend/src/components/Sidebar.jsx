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

  return (
    <aside className="sidebar sidebar-root">
      {/* Branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 50%, #22c55e 100%)",
          }}
        />
        <div>
          <div
            style={{
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontSize: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            VeriFirma
          </div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Panel principal
          </div>
        </div>
      </div>

      {/* Usuario */}
      <div
        style={{
          marginBottom: 16,
          padding: 8,
          borderRadius: 10,
          background: "#0f172a",
          color: "#e5e7eb",
          fontSize: "0.7rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Sesión activa
            </div>
            <div>{user?.name || "Usuario"}</div>
            <div style={{ opacity: 0.7 }}>
              {user?.email || "usuario@correo.com"}
            </div>
          </div>
          <div
            style={{
              alignSelf: "flex-start",
              paddingInline: 8,
              paddingBlock: 2,
              borderRadius: 999,
              background: "#1f2937",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {user?.role || "USER"}
          </div>
        </div>
      </div>

      {/* Bandeja */}
      <h3 className="sidebar-section-label">Bandeja</h3>

      <div
        className={`nav-item ${view === "list" ? "active" : ""}`}
        onClick={() => handleChangeView("list")}
        title="Ver todos los trámites"
      >
        <span>📄</span> Mis trámites
      </div>

      <div
        className={`nav-item ${view === "upload" ? "active" : ""}`}
        onClick={() => handleChangeView("upload")}
        title="Crear nuevo trámite de firma"
      >
        <span>📤</span> Crear nuevo trámite
      </div>

      {/* Atajos */}
      <h3 className="sidebar-section-label">Atajos</h3>

      <div
        className={`nav-item ${
          statusFilter === "PENDIENTES" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("PENDIENTES")}
        title="Mostrar solo documentos pendientes"
      >
        <span>⏳</span> Solo pendientes
      </div>

      <div
        className={`nav-item ${
          statusFilter === "FIRMADOS" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("FIRMADOS")}
        title="Mostrar solo documentos firmados"
      >
        <span>✅</span> Solo firmados
      </div>

      <div
        className={`nav-item ${
          statusFilter === "RECHAZADOS" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("RECHAZADOS")}
        title="Mostrar solo documentos rechazados"
      >
        <span>❌</span> Solo rechazados
      </div>

      <div
        className={`nav-item ${view === "verification" ? "active" : ""}`}
        onClick={() => handleChangeView("verification")}
        title="Verificar estado público de documentos"
      >
        <span>🔍</span> Verificar documento
      </div>

      {/* Reportes */}
      <h3 className="sidebar-section-label">Reportes</h3>

      <div
        className={`nav-item ${
          view === "email-metrics" ? "active" : ""
        }`}
        onClick={() => handleChangeView("email-metrics")}
        title="Ver métricas de email"
      >
        <span>📊</span> Analytics
      </div>

      <div
        className={`nav-item ${
          view === "company-analytics" ? "active" : ""
        }`}
        onClick={() => handleChangeView("company-analytics")}
        title="Analytics de la empresa"
      >
        <span>📈</span> Analytics Empresa
      </div>

      <div
        className={`nav-item ${view === "pricing" ? "active" : ""}`}
        onClick={() => handleChangeView("pricing")}
        title="Ver planes y facturación"
      >
        <span>💳</span> Planes y facturación
      </div>

      <div
        className={`nav-item ${view === "templates" ? "active" : ""}`}
        onClick={() => handleChangeView("templates")}
        title="Gestionar plantillas de documentos"
      >
        <span>📋</span> Plantillas
      </div>

      <div
        className={`nav-item ${view === "profile" ? "active" : ""}`}
        onClick={() => handleChangeView("profile")}
        title="Editar tu perfil"
      >
        <span>👤</span> Mi perfil
      </div>

      {/* Administración */}
      {showAdminSection && (
        <>
          <h3 className="sidebar-section-label">Administración</h3>

          <div
            className={`nav-item ${view === "users" ? "active" : ""}`}
            onClick={() => handleChangeView("users")}
            title="Gestionar usuarios de la empresa"
          >
            <span>👥</span> Usuarios
          </div>

          <div
            className={`nav-item ${
              view === "reminders-config" ? "active" : ""
            }`}
            onClick={() => handleChangeView("reminders-config")}
            title="Configurar recordatorios automáticos"
          >
            <span>🔔</span> Recordatorios
          </div>

          <div
            className={`nav-item ${
              view === "dashboard" ? "active" : ""
            }`}
            onClick={() => handleChangeView("dashboard")}
            title="Dashboard administrativo"
          >
            <span>📊</span> Dashboard
          </div>

          {isAdminGlobalOrOwner && (
            <>
              <div
                className={`nav-item ${
                  view === "companies" ? "active" : ""
                }`}
                onClick={() => handleChangeView("companies")}
                title="Gestionar empresas"
              >
                <span>🏢</span> Empresas
              </div>

              <div
                className={`nav-item ${
                  view === "status" ? "active" : ""
                }`}
                onClick={() => handleChangeView("status")}
                title="Estado del sistema"
              >
                <span>⚙️</span> Estado Sistema
              </div>

              <div
                className={`nav-item ${
                  view === "audit-logs" ? "active" : ""
                }`}
                onClick={() => handleChangeView("audit-logs")}
                title="Auditoría de negocio"
              >
                <span>📜</span> Auditoría (negocio)
              </div>

              <div
                className={`nav-item ${
                  view === "auth-logs" ? "active" : ""
                }`}
                onClick={() => handleChangeView("auth-logs")}
                title="Logs de autenticación"
              >
                <span>🔐</span> Auth logs
              </div>
            </>
          )}
        </>
      )}

      {/* Footer: resumen + logout */}
      <div
        style={{
          marginTop: "auto",
          marginBottom: 8,
          padding: 8,
          borderRadius: 10,
          background: "#020617",
          color: "#9ca3af",
          fontSize: "0.68rem",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          Trámites totales: <strong>{totalDocs}</strong>
        </div>
        <div>
          Pendientes hoy: <strong>{pendientes}</strong>
        </div>
      </div>

      <div
        className="nav-item"
        onClick={logout}
        style={{ marginTop: 0 }}
        title="Cerrar sesión"
      >
        <span>🚪</span> Cerrar sesión
      </div>
    </aside>
  );
}