// src/views/PublicSignView.jsx
import React from 'react';

export function PublicSignView({
  publicSignLoading,
  publicSignError,
  publicSignDoc,      // { document, signer }
  publicSignPdfUrl,
  publicSignToken,    // token = sign_token del firmante, o signature_token para visado
  publicSignMode,     // "visado" o null
  API_URL,
  cargarFirmaPublica, // GET /api/public/docs/:token
}) {
  const pdfUrl = publicSignPdfUrl || '';
  const isVisado = publicSignMode === 'visado';

  // publicSignDoc viene del backend como: { document: {...}, signer: {...} }
  const document = publicSignDoc?.document || null;
  const signer = publicSignDoc?.signer || null;

  async function handleConfirm() {
    try {
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

      // Recargar datos actualizados del backend (estado documento/firmante)
      await cargarFirmaPublica(publicSignToken);
    } catch (err) {
      alert('❌ ' + err.message);
    }
  }

  const alreadySignedByThisSigner =
    !isVisado && signer && signer.status === 'FIRMADO';
  const docFullySigned =
    !isVisado && document && document.status === 'FIRMADO';

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 800 }}>
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

        {document && !publicSignLoading && !publicSignError && (
          <>
            <p
              style={{
                textAlign: 'center',
                color: '#64748b',
                marginBottom: 20,
              }}
            >
              Documento: <strong>{document.title}</strong>
              <br />
              Empresa:{' '}
              <strong>{document.destinatario_nombre}</strong> (RUT{' '}
              {document.empresa_rut})
            </p>

            {!isVisado && signer && (
              <p
                style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: 10,
                  textAlign: 'center',
                }}
              >
                Estás firmando como:{' '}
                <strong>{signer.name}</strong> ({signer.email})
              </p>
            )}

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

            {!isVisado && document.firmante_nombre && (
              <p
                style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: 20,
                }}
              >
                Representante legal principal:{' '}
                <strong>{document.firmante_nombre}</strong> (RUN{' '}
                {document.firmante_run})
              </p>
            )}

            {isVisado ? (
              document.signature_status === 'FIRMADO' ? (
                <p
                  style={{
                    textAlign: 'center',
                    color: '#16a34a',
                    fontWeight: 700,
                    marginTop: 10,
                  }}
                >
                  Este documento ya fue firmado, no es posible modificar su
                  estado.
                </p>
              ) : (
                <button
                  className="btn-main btn-primary"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={handleConfirm}
                >
                  VISAR DOCUMENTO
                </button>
              )
            ) : docFullySigned ? (
              <p
                style={{
                  textAlign: 'center',
                  color: '#16a34a',
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Este documento ya fue firmado por todos los firmantes.
              </p>
            ) : alreadySignedByThisSigner ? (
              <p
                style={{
                  textAlign: 'center',
                  color: '#16a34a',
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Ya has firmado este documento.
              </p>
            ) : (
              <button
                className="btn-main btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={handleConfirm}
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
