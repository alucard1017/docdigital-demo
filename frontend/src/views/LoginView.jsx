// src/views/LoginView.jsx
import React from 'react';

export function LoginView({
  run,
  setRun,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  showHelp,
  setShowHelp,
  message,
  isLoggingIn,
  handleLogin,
}) {
  return (
    <div className="login-bg">
      <div className="login-card">
        <h1
          style={{
            textAlign: 'center',
            color: '#1e3a8a',
            marginBottom: 10,
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          VeriFirma
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.85rem',
            marginBottom: 35,
          }}
        >
          Inicie sesión para gestionar sus documentos
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'block',
                marginBottom: 10,
                color: '#475569',
              }}
            >
              RUN / USUARIO
            </label>
            <input
              className="input-field"
              value={run}
              onChange={(e) => setRun(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 25 }}>
            <label
              style={{
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'block',
                marginBottom: 10,
                color: '#475569',
              }}
            >
              CONTRASEÑA
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '70px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 15,
                  top: 14,
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {showPassword ? 'OCULTAR' : 'VER'}
              </button>
            </div>
          </div>

          <button
            className="btn-main btn-primary"
            style={{ width: '100%', fontSize: '1.1rem' }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Conectando…' : 'ACCEDER AL PORTAL'}
          </button>
          <button
            type="button"
            style={{
              width: '100%',
              marginTop: 20,
              fontSize: 12,
              color: '#64748b',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={() => setShowHelp(!showHelp)}
          >
            ¿Perdiste tu contraseña o ClaveÚnica?
          </button>
        </form>

        {showHelp && (
          <div className="help-panel">
            <strong>Recuperación de acceso:</strong>
            <br />
            Si utiliza ClaveÚnica, recupérela en <strong>claveunica.gob.cl</strong>. Para cuentas
            administrativas (Alucard), contacte al soporte técnico.
          </div>
        )}

        {message && (
          <p
            style={{
              textAlign: 'center',
              marginTop: 30,
              fontWeight: 700,
              color: message.includes('❌') ? '#ef4444' : '#10b981',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
