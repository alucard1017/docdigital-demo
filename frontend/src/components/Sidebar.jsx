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
  const OWNER_ID = 7; // ajusta si cambia en tu BD
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

  return (
    <aside className="sidebar">
      <h2>VeriFirma</h2>

      {/* Bloque usuario */}
      <div
        style={{
          marginTop: 8,
          marginBottom: 14,
          padding: 8,
          borderRadius: 10,
          background: "#0f172a",
          color: "#e5e7eb",
          fontSize: "0.7rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Sesión activa</div>
        <div>{user?.name || "Usuario"}</div>
        <div style={{ opacity: 0.7 }}>
          {user?.email || "usuario@correo.com"}
        </div>
        <div style={{ opacity: 0.7 }}>Rol: {user?.role || "USER"}</div>
      </div>

      {/* Sección Bandeja */}
      <h3
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        Bandeja
      </h3>

      <div
        className={`nav-item ${view === "list" ? "active" : ""}`}
        onClick={() => handleChangeView("list")}
      >
        <span>📄</span> Mis trámites
      </div>

      <div
        className={`nav-item ${view === "upload" ? "active" : ""}`}
        onClick={() => handleChangeView("upload")}
      >
        <span>📤</span> Crear nuevo trámite
      </div>

      {/* Sección Atajos */}
      <h3
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        Atajos
      </h3>

      <div
        className={`nav-item ${
          statusFilter === "PENDIENTES" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("PENDIENTES")}
      >
        <span>⏳</span> Solo pendientes
      </div>

      <div
        className={`nav-item ${
          statusFilter === "FIRMADOS" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("FIRMADOS")}
      >
        <span>✅</span> Solo firmados
      </div>

      <div
        className={`nav-item ${
          statusFilter === "RECHAZADOS" ? "active" : ""
        }`}
        onClick={() => handleStatusFilter("RECHAZADOS")}
      >
        <span>❌</span> Solo rechazados
      </div>

      {/* Verificación pública */}
      <div
        className={`nav-item ${view === "verification" ? "active" : ""}`}
        onClick={() => handleChangeView("verification")}
      >
        <span>🔍</span> Verificar documento
      </div>

      {/* Sección Reportes */}
      <h3
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        Reportes
      </h3>

      <div
        className={`nav-item ${view === "analytics" ? "active" : ""}`}
        onClick={() => handleChangeView("analytics")}
      >
        <span>📊</span> Analytics
      </div>

      {isAnyAdmin && (
        <div
          className={`nav-item ${view === "dashboard" ? "active" : ""}`}
          onClick={() => handleChangeView("dashboard")}
        >
          <span>📈</span> Dashboard
        </div>
      )}

      {isAnyAdmin && (
        <div
          className={`nav-item ${view === "status" ? "active" : ""}`}
          onClick={() => handleChangeView("status")}
        >
          <span>🩺</span> Estado
        </div>
      )}

      {/* Sección Administración */}
      {showAdminSection && (
        <>
          <h3
            style={{
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7280",
              marginTop: 14,
              marginBottom: 4,
            }}
          >
            Administración
          </h3>

          <div
            className={`nav-item ${view === "users" ? "active" : ""}`}
            onClick={() => handleChangeView("users")}
          >
            <span>👥</span> Usuarios
          </div>

          {isAdminGlobalOrOwner && (
            <>
              <div
                className={`nav-item ${
                  view === "companies" ? "active" : ""
                }`}
                onClick={() => handleChangeView("companies")}
              >
                <span>🏢</span> Empresas
              </div>

              <div
                className={`nav-item ${
                  view === "audit-logs" ? "active" : ""
                }`}
                onClick={() => handleChangeView("audit-logs")}
              >
                <span>📜</span> Auditoría (negocio)
              </div>

              <div
                className={`nav-item ${
                  view === "auth-logs" ? "active" : ""
                }`}
                onClick={() => handleChangeView("auth-logs")}
              >
                <span>🔐</span> Auth logs
              </div>
            </>
          )}
        </>
      )}

      {/* Mini resumen */}
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
          Trámites totales: <strong>{docs.length}</strong>
        </div>
        <div>
          Pendientes hoy: <strong>{pendientes}</strong>
        </div>
      </div>

      {/* Logout */}
      <div className="nav-item" onClick={logout} style={{ marginTop: 0 }}>
        <span>🚪</span> Cerrar sesión
      </div>
    </aside>
  );
}
