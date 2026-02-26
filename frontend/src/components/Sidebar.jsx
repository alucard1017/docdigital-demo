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
}) {
  const OWNER_ID = 7; // ajusta si cambia en tu base de datos

  // Consideramos admin_global y SUPER_ADMIN como administradores globales
  const isOwner = user?.id === OWNER_ID;
  const isGlobalAdmin =
    user?.role === "admin_global" || user?.role === "SUPER_ADMIN";

  const showUsersMenu = isOwner || isGlobalAdmin;

  const handleChangeView = (nextView) => {
    setView(nextView);
  };

  const handleStatusFilter = (filter) => {
    setStatusFilter(filter);
  };

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
        <div style={{ opacity: 0.7 }}>
          Rol: {user?.role || "FIRMANTE"}
        </div>
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

      <div
        className={`nav-item ${view === "dashboard" ? "active" : ""}`}
        onClick={() => handleChangeView("dashboard")}
      >
        <span>📈</span> Dashboard
      </div>

      {/* Sección Administración */}
      {showUsersMenu && (
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
