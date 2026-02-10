// src/views/PublicSignView.jsx
import React from 'react';

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,
  publicSignPdfUrl,
  publicSignToken,
  publicSignMode,        // <-- viene desde App.jsx: "visado" o null
  API_URL,
  cargarFirmaPublica,
}) {
  const pdfUrl = publicSignPdfUrl || '';
  const isVisado = publicSignMode === 'visado';

  async function handleConfirm() {
    try {
      // Endpoint público distinto según sea visado o firma
      const actionPath = isVisado ? 'visar' : 'firmar';

      const res = await fetch(
        `${API_URL}/api/public/docs/${publicSignToken}/${actionPath}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ||
            (isVisado
              ? 'No se pudo registrar el visado'
              : 'No se pudo registrar la firma')
        );
      }

      alert(
        isVisado
          ? '✅ Visado registrado correctamente'
          : '✅ Firma registrada correctamente'
      );
      cargarFirmaPublica(publicSignToken);
    } catch (err) {
      alert('❌ ' + err.message);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 800 }}>
        {/* Título cambia según modo */}
        <h1
          style={{
            textAlign: 'center',
            color: isVisado ? '#b45309' : '#1e3a8a',
            marginBottom: 10,
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          {isVisado ? 'Visado de Documento' : 'Firma de Documento'}
        </h1>

        {/* Banner legal según modo */}
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 8,
            backgroundColor: isVisado ? '#fffbeb' : '#eff6ff',
            border: `1px solid ${isVisado ? '#f59e0b' : '#3b82f6'}`,
            color: isVisado ? '#92400e' : '#1e3a8a',
            fontSize: '0.9rem',
          }}
        >
          {isVisado ? (
            <>
              <strong>Estás VISANDO este documento.</strong>{' '}
              El visado deja constancia de que revisaste y validaste su
              contenido, pero no equivale a la firma definitiva del
              representante legal.
            </>
          ) : (
            <>
              <strong>Estás FIRMANDO electrónicamente este documento.</strong>{' '}
              Esta acción corresponde a la aceptación y firma definitiva del
              contenido del documento.
            </>
          )}
        </div>

        {publicSignLoading && (
          <p style={{ textAlign: 'center', marginTop: 20 }}>
            Cargando información del documento…
          </p>
        )}

        {publicSignError && (
          <p
            style={{
              textAlign: 'center',
              marginTop: 20,
              color: '#b91c1c',
              fontWeight: 600,
            }}
          >
            {publicSignError}
          </p>
        )}

        {publicSignDoc && !publicSignLoading && !publicSignError && (
          <>
            <p
              style={{
                textAlign: 'center',
                color: '#64748b',
                marginBottom: 20,
              }}
            >
              Documento: <strong>{publicSignDoc.title}</strong>
              <br />
              Empresa:{' '}
              <strong>{publicSignDoc.destinatario_nombre}</strong> (RUT{' '}
              {publicSignDoc.empresa_rut})
            </p>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-main btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Ver documento en PDF
              </a>
            </div>

            <p
              style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: 20,
              }}
            >
              Representante legal:{' '}
              <strong>{publicSignDoc.firmante_nombre}</strong> (RUN{' '}
              {publicSignDoc.firmante_run})
            </p>

            {publicSignDoc.signature_status === 'FIRMADO' ? (
              <p
                style={{
                  textAlign: 'center',
                  color: '#16a34a',
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Este documento ya fue firmado.
              </p>
            ) : (
              <button
                className="btn-main btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={handleConfirm}
              >
                {isVisado ? 'VISAR DOCUMENTO' : 'FIRMAR DOCUMENTO'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
