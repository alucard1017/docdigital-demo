// src/views/NewDocumentForm.jsx
import React from 'react';

export function NewDocumentForm({
  API_URL,
  token,
  tipoTramite,
  setTipoTramite,
  formErrors,
  setFormErrors,
  showVisador,
  setShowVisador,
  extraSigners,
  setExtraSigners,
  firmanteRunValue,
  setFirmanteRunValue,
  empresaRutValue,
  setEmpresaRutValue,
  formatRunDoc,
  setView,
  cargarDocs,
}) {
  return (
    <div className="card-premium">
      <h1
        style={{
          fontSize: '1.4rem',
          marginBottom: 8,
        }}
      >
        Crear nuevo trámite
      </h1>
      <p
        style={{
          color: '#64748b',
          marginBottom: 16,
          fontSize: '1.05rem',
        }}
      >
        Configure los participantes y cargue el PDF.
      </p>

      {/* Botones de tipo de trámite */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          className="btn-main"
          style={{
            backgroundColor:
              tipoTramite === 'propio' ? '#0f766e' : '#e5e7eb',
            color: tipoTramite === 'propio' ? '#ffffff' : '#111827',
          }}
          onClick={() => setTipoTramite('propio')}
        >
          Trámite propio (sin notaría)
        </button>

        <button
          type="button"
          className="btn-main"
          style={{
            backgroundColor:
              tipoTramite === 'notaria' ? '#1d4ed8' : '#e5e7eb',
            color: tipoTramite === 'notaria' ? '#ffffff' : '#111827',
          }}
          onClick={() => setTipoTramite('notaria')}
        >
          Trámite con notaría
        </button>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setFormErrors({});

          const form = e.target;
          const formData = new FormData(form);

          // tipo de trámite
          formData.append('tipoTramite', tipoTramite);
          if (tipoTramite === 'notaria') {
            formData.append('requiere_firma_notarial', 'true');
          }

          const firmanteRunClean = firmanteRunValue.replace(/[^0-9kK]/g, '');
          const empresaRutClean = empresaRutValue.replace(/[^0-9kK]/g, '');

          const title = form.title.value.trim();
          const firmanteEmail = form.firmante_email.value.trim();

          // Campos firmante
          const firmanteNombre1 = form.firmante_nombre1.value.trim();
          const firmanteNombre2 =
            (form.firmante_nombre2?.value || '').trim();
          const firmanteApellido1 =
            form.firmante_apellido1.value.trim();
          const firmanteApellido2 =
            (form.firmante_apellido2?.value || '').trim();
          const firmanteMovil = form.firmante_movil.value.trim();

          // Destinatario / empresa
          const destinatarioNombre =
            form.destinatario_nombre?.value.trim() || '';
          const destinatarioEmail =
            form.destinatario_email.value.trim();

          const file = form.file?.files?.[0];

          const newErrors = {};

          if (!title)
            newErrors.title = 'Este campo es obligatorio.';
          if (!file)
            newErrors.file = 'Adjunta un archivo PDF.';

          // Validaciones firmante
          if (!firmanteNombre1)
            newErrors.firmante_nombre1 =
              'Este campo es obligatorio.';
          if (!firmanteApellido1)
            newErrors.firmante_apellido1 =
              'Este campo es obligatorio.';
          if (!firmanteEmail)
            newErrors.firmante_email =
              'Ingresa un correo válido.';
          if (!firmanteRunClean)
            newErrors.firmante_run = 'RUN / RUT es obligatorio.';
          else if (
            firmanteRunClean.length < 8 ||
            firmanteRunClean.length > 10
          ) {
            newErrors.firmante_run =
              'RUN inválido (ej: 12.345.678-9)';
          }
          if (!firmanteMovil)
            newErrors.firmante_movil =
              'El teléfono es obligatorio.';

          // Validaciones destinatario / empresa
          if (!destinatarioNombre)
            newErrors.destinatario_nombre =
              'Este campo es obligatorio.';
          if (!destinatarioEmail)
            newErrors.destinatario_email =
              'Ingresa un correo válido.';
          if (!empresaRutClean)
            newErrors.empresa_rut =
              'El RUT de la empresa es obligatorio.';
          else if (
            empresaRutClean.length < 8 ||
            empresaRutClean.length > 10
          ) {
            newErrors.empresa_rut =
              'RUT inválido (ej: 12.345.678-9)';
          }

          if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            return;
          }

          const firmanteNombreCompleto = [
            firmanteNombre1,
            firmanteNombre2,
            firmanteApellido1,
            firmanteApellido2,
          ]
            .filter(Boolean)
            .join(' ');

          formData.append(
            'firmante_nombre_completo',
            firmanteNombreCompleto
          );
          formData.append('firmante_run', firmanteRunValue);
          formData.append('firmante_movil', firmanteMovil);
          formData.append('empresa_rut', empresaRutValue);
          formData.append(
            'requiresVisado',
            showVisador ? 'true' : 'false'
          );

          // Firmante adicional (por ahora solo el primero)
          if (extraSigners.length > 0) {
            const idx = 0;
            const nombreExtra =
              form[`extra_nombre_${idx}`]?.value.trim() || '';
            const emailExtra =
              form[`extra_email_${idx}`]?.value.trim() || '';
            const movilExtra =
              form[`extra_movil_${idx}`]?.value.trim() || '';

            if (emailExtra) {
              formData.append(
                'firmante_adicional_nombre_completo',
                nombreExtra
              );
              formData.append(
                'firmante_adicional_email',
                emailExtra
              );
              formData.append(
                'firmante_adicional_movil',
                movilExtra
              );
            }
          }

          try {
            const res = await fetch(`${API_URL}/api/docs`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
            if (!res.ok) throw new Error('Fallo en la subida');
            alert('✅ ¡Documento procesado correctamente!');
            form.reset();
            setShowVisador(false);
            setExtraSigners([]);
            setFirmanteRunValue('');
            setEmpresaRutValue('');
            setView('list');
            cargarDocs();
          } catch (err) {
            alert(err.message);
          }
        }}
      >
        {/* === TÍTULO DEL CONTRATO + BOTÓN PDF === */}
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            gap: 16,
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Nombre del contrato / trámite *
            </label>
            <input
              name="title"
              className="input-field"
              placeholder="Ej: Contrato de prestación de servicios"
            />
            {formErrors.title && (
              <p
                style={{
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  marginTop: 4,
                }}
              >
                {formErrors.title}
              </p>
            )}
          </div>

          {/* input file oculto */}
          <input
            type="file"
            name="file"
            accept="application/pdf"
            id="file-input-contrato"
            style={{ display: 'none' }}
          />

          {/* botón visible al lado del título */}
          <div>
            <label
              style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Archivo PDF *
            </label>
            <button
              type="button"
              className="btn-main"
              style={{
                background: '#0f766e',
                color: '#ffffff',
                padding: '10px 24px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                const el = document.getElementById('file-input-contrato');
                if (el) el.click();
              }}
            >
              Subir contrato (PDF)
            </button>
            {formErrors.file && (
              <p
                style={{
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  marginTop: 4,
                }}
              >
                {formErrors.file}
              </p>
            )}
          </div>
        </div>

        {/* === DESCRIPCIÓN Y OBSERVACIONES === */}
        <div style={{ marginBottom: 30 }}>
          <label
            style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'block',
              marginBottom: 10,
            }}
          >
            DESCRIPCIÓN Y OBSERVACIONES
          </label>
          <textarea
            name="description"
            className="input-field"
            rows="4"
            placeholder="Indique detalles relevantes..."
          />
        </div>

        {/* === VISADOR === */}
        <div
          style={{
            background: '#f1f5f9',
            padding: 24,
            borderRadius: 22,
            marginBottom: 32,
            border: '1px solid '#e2e8f0',
          }}
        >
          <label
            style={{
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '1.05rem',
              color: '#1e293b',
            }}
          >
            <input
              type="checkbox"
              checked={showVisador}
              onChange={(e) => setShowVisador(e.target.checked)}
              style={{
                marginRight: 15,
                width: 22,
                height: 22,
              }}
            />
            ¿Este envío requiere la revisión previa de un Visador?
          </label>

          {showVisador && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 20,
                marginTop: 24,
              }}
            >
              <input
                name="visador_nombre"
                className="input-field"
                placeholder="Nombre Visador"
                required={showVisador}
              />
              <input
                name="visador_email"
                type="email"
                className="input-field"
                placeholder="Email Visador"
                required={showVisador}
              />
              <input
                name="visador_movil"
                className="input-field"
                placeholder="Móvil (Opcional)"
              />
            </div>
          )}
        </div>

        {/* === FIRMANTE Y DESTINATARIO === */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          {/* FIRMANTE FINAL */}
          <div className="card-mini" style={{ marginTop: 0 }}>
            <h4>✍️ Firmante Final (Responsable)</h4>
            <div className="card-content">
              <input
                name="firmante_nombre1"
                className="input-field"
                required
                placeholder="Primer nombre *"
              />
              {formErrors.firmante_nombre1 && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_nombre1}
                </p>
              )}

              <input
                name="firmante_nombre2"
                className="input-field"
                placeholder="Segundo nombre"
              />

              <input
                name="firmante_apellido1"
                className="input-field"
                required
                placeholder="Primer apellido *"
              />
              {formErrors.firmante_apellido1 && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_apellido1}
                </p>
              )}

              <input
                name="firmante_apellido2"
                className="input-field"
                placeholder="Segundo apellido"
              />

              <input
                name="firmante_email"
                type="email"
                className="input-field"
                required
                placeholder="Email corporativo *"
              />
              {formErrors.firmante_email && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_email}
                </p>
              )}

              <input
                name="firmante_run"
                className="input-field"
                required
                placeholder="RUN / RUT del representante *"
                value={firmanteRunValue}
                onChange={(e) =>
                  setFirmanteRunValue(formatRunDoc(e.target.value))
                }
              />
              {formErrors.firmante_run && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_run}
                </p>
              )}

              <input
                name="firmante_movil"
                className="input-field"
                required
                placeholder="Teléfono móvil del representante *"
              />
              {formErrors.firmante_movil && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_movil}
                </p>
              )}
            </div>
          </div>

          {/* DESTINATARIO / EMPRESA */}
          <div className="card-mini" style={{ marginTop: 0 }}>
            <h4>🏢 Destinatario / Empresa</h4>
            <div className="card-content">
              <input
                name="destinatario_nombre"
                className="input-field"
                required
                placeholder="Razón Social *"
              />
              {formErrors.destinatario_nombre && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.destinatario_nombre}
                </p>
              )}

              <input
                name="empresa_rut"
                className="input-field"
                required
                placeholder="RUT de la empresa *"
                value={empresaRutValue}
                onChange={(e) =>
                  setEmpresaRutValue(formatRunDoc(e.target.value))
                }
              />
              {formErrors.empresa_rut && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.empresa_rut}
                </p>
              )}

              <input
                name="destinatario_email"
                type="email"
                className="input-field"
                required
                placeholder="Email de contacto *"
              />
              {formErrors.destinatario_email && (
                <p
                  style={{
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  {formErrors.destinatario_email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FIRMANTES ADICIONALES */}
        {extraSigners.map((signer, index) => (
          <div key={signer.id} className="card-mini">
            <h4>
              <span>➕ Firmante Adicional #{index + 1}</span>
              <button
                type="button"
                onClick={() =>
                  setExtraSigners(
                    extraSigners.filter((s) => s.id !== signer.id)
                  )
                }
                style={{
                  color: '#ef4444',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
                ELIMINAR
              </button>
            </h4>
            <div
              className="card-content"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 20,
              }}
            >
              <input
                name={`extra_nombre_${index}`}
                className="input-field"
                placeholder="Nombre completo *"
                required
              />
              <input
                name={`extra_email_${index}`}
                type="email"
                className="input-field"
                placeholder="Email *"
                required
              />
              <input
                name={`extra_movil_${index}`}
                className="input-field"
                placeholder="Móvil"
              />
            </div>
          </div>
        ))}

        {/* BOTONES FINALES */}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            gap: 16,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 24,
          }}
        >
          <button
            type="button"
            className="btn-main"
            onClick={() =>
              setExtraSigners([
                ...extraSigners,
                { id: Date.now() },
              ])
            }
            style={{
              background: '#e2e8f0',
              color: '#475569',
              padding: '12px 26px',
            }}
          >
            + Añadir firmante adicional
          </button>
          <button
            type="submit"
            className="btn-main btn-primary"
            style={{
              padding: '12px 80px',
              fontSize: '1rem',
              flexGrow: 1,
            }}
          >
            INICIAR FLUJO DE FIRMA DIGITAL
          </button>
        </div>
      </form>
    </div>
  );
}
