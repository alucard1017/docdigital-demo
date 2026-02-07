// src/views/PublicSignView.jsx
import React from 'react';

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,
  publicSignPdfUrl,
  publicSignToken,
  API_URL,
  cargarFirmaPublica,
}) {
  const pdfUrl = publicSignPdfUrl || '';

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 800 }}>
        <h1
          style={{
            textAlign: 'center',
            color: '#1e3a8a',
            marginBottom: 10,
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          Firma de Documento
        </h1>

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
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${API_URL}/api/public/docs/${publicSignToken}/firmar`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      }
                    );
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(
                        data.message || 'No se pudo registrar la firma'
                      );
                    }
                    alert('✅ Firma registrada correctamente');
                    cargarFirmaPublica(publicSignToken);
                  } catch (err) {
                    alert('❌ ' + err.message);
                  }
                }}
              >
                FIRMAR DOCUMENTO
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
