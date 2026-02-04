// src/components/Sidebar.jsx
import React from 'react';

export function Sidebar({
  user,
  docs,
  pendientes,
  view,
  setView,
  statusFilter,
  setStatusFilter,
  logout
}) {
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="sidebar">
      <h2>Firma Express</h2>

      {/* Bloque usuario */}
      <div
        style={{
          marginTop: 12,
          marginBottom: 24,
          padding: 12,
          borderRadius: 12,
          background: '#0f172a',
          color: '#e5e7eb',
          fontSize: '0.85rem'
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          Sesión activa
        </div>
        <div>{user?.email || 'usuario@correo.com'}</div>
        <div style={{ opacity: 0.7 }}>
          Rol: {user?.role || 'FIRMANTE'}
        </div>
      </div>

      {/* Sección Bandeja */}
      <h3
        style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6b7280',
          marginBottom: 8
        }}
      >
        Bandeja
      </h3>

      <div
        className={`nav-item ${view === 'list' ? 'active' : ''}`}
        onClick={() => setView('list')}
      >
        <span>📄</span> Mis Documentos
      </div>
      <div
        className={`nav-item ${view === 'upload' ? 'active' : ''}`}
        onClick={() => setView('upload')}
      >
        <span>📤</span> Subir Nuevo PDF
      </div>

      {/* Sección Atajos */}
      <h3
        style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6b7280',
          marginTop: 24,
          marginBottom: 8
        }}
      >
        Atajos
      </h3>

      {/* Atajo: solo pendientes */}
      <div
        className={`nav-item ${
          statusFilter === 'PENDIENTES' ? 'active' : ''
        }`}
        onClick={() => setStatusFilter('PENDIENTES')}
      >
        <span>⏳</span> Solo pendientes
      </div>

      {/* Atajo: solo firmados */}
      <div
        className={`nav-item ${
          statusFilter === 'FIRMADOS' ? 'active' : ''
        }`}
        onClick={() => setStatusFilter('FIRMADOS')}
      >
        <span>✅</span> Solo firmados
      </div>

      {/* Sección Administración (solo admins) */}
      {isAdmin && (
        <>
          <h3
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#6b7280',
              marginTop: 24,
              marginBottom: 8
            }}
          >
            Administración
          </h3>

          <div
            className={`nav-item ${view === 'users' ? 'active' : ''}`}
            onClick={() => setView('users')}
          >
            <span>👥</span> Usuarios
          </div>
        </>
      )}

      {/* Mini resumen + logout abajo */}
      <div
        style={{
          marginTop: 'auto',
          marginBottom: 12,
          padding: 10,
          borderRadius: 12,
          background: '#020617',
          color: '#9ca3af',
          fontSize: '0.8rem'
        }}
      >
        <div style={{ marginBottom: 4 }}>
          Documentos totales: <strong>{docs.length}</strong>
        </div>
        <div>
          Pendientes hoy: <strong>{pendientes}</strong>
        </div>
      </div>

      <div
        style={{ marginTop: 0 }}
        className="nav-item"
        onClick={logout}
      >
        <span>🚪</span> Cerrar Sesión
      </div>
    </aside>
  );
}
