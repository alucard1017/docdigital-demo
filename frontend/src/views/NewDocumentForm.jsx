import React, { useState } from "react";
import api from "../api/client";
import "../styles/newDocumentForm.css";

const TIPOS_TRAMITE = [
  { value: "propio", label: "Trámite propio (sin notaría)" },
  { value: "notaria", label: "Trámite con notaría" },
];

const TIPOS_DOCUMENTO = [
  { value: "poderes", label: "Poderes y autorizaciones" },
  { value: "contratos", label: "Solo contratos" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function isValidEmail(value) {
  return EMAIL_REGEX.test((value || "").trim());
}

function isPdfFile(file) {
  if (!file) return false;
  const byType = file.type === "application/pdf";
  const byName = file.name?.toLowerCase().endsWith(".pdf");
  return byType || byName;
}

export function NewDocumentForm({
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
  goToList,
  cargarDocs,
}) {
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [tipoFlujo, setTipoFlujo] = useState("SECUENCIAL");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const resetFormState = (form) => {
    form.reset();
    setShowVisador(false);
    setExtraSigners([]);
    setFirmanteRunValue("");
    setEmpresaRutValue("");
    setTipoDocumento("");
    setTipoFlujo("SECUENCIAL");
    setFileName("");
    setFormErrors({});
  };

  const addExtraSigner = () => {
    setExtraSigners((prev) => [...prev, { id: Date.now() + Math.random() }]);
  };

  const removeExtraSigner = (id) => {
    setExtraSigners((prev) => prev.filter((signer) => signer.id !== id));
    setFormErrors((prev) => {
      const next = { ...prev };
      const nextSigners = extraSigners.filter((signer) => signer.id !== id);

      Object.keys(next).forEach((key) => {
        if (key.startsWith("extra_nombre_") || key.startsWith("extra_email_")) {
          delete next[key];
        }
      });

      nextSigners.forEach((_, index) => {
        const oldNameKey = `extra_nombre_${index}`;
        const oldEmailKey = `extra_email_${index}`;
        if (prev[oldNameKey]) next[oldNameKey] = prev[oldNameKey];
        if (prev[oldEmailKey]) next[oldEmailKey] = prev[oldEmailKey];
      });

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitMessage("");
    setSubmitting(true);

    const form = e.currentTarget;
    const newErrors = {};

    const titleRaw = (form.elements.title?.value || "").trim();
    const description = (form.elements.description?.value || "").trim();
    const file = form.elements.file?.files?.[0];

    const firmanteNombre1 = (form.elements.firmante_nombre1?.value || "").trim();
    const firmanteNombre2 = (form.elements.firmante_nombre2?.value || "").trim();
    const firmanteApellido1 = (form.elements.firmante_apellido1?.value || "").trim();
    const firmanteApellido2 = (form.elements.firmante_apellido2?.value || "").trim();
    const firmanteEmail = (form.elements.firmante_email?.value || "").trim();
    const firmanteMovil = (form.elements.firmante_movil?.value || "").trim();

    const destinatarioNombre = (form.elements.destinatario_nombre?.value || "").trim();
    const destinatarioEmail = (form.elements.destinatario_email?.value || "").trim();

    const visadorNombre = (form.elements.visador_nombre?.value || "").trim();
    const visadorEmail = (form.elements.visador_email?.value || "").trim();
    const visadorMovil = (form.elements.visador_movil?.value || "").trim();

    const firmanteRunClean = firmanteRunValue.replace(/[^0-9kK]/g, "");
    const empresaRutClean = empresaRutValue.replace(/[^0-9kK]/g, "");

    if (!tipoDocumento) {
      newErrors.tipo_documento =
        "Selecciona si es Poderes y autorizaciones o Solo contratos.";
    }

    const title = titleRaw || (file?.name || "").replace(/\.pdf$/i, "").trim();
    if (!title || title.length < 2) {
      newErrors.title = "El título debe tener al menos 2 caracteres.";
    } else if (title.length > 255) {
      newErrors.title = "El título no puede superar 255 caracteres.";
    }

    if (!file) {
      newErrors.file = "Adjunta un archivo PDF.";
    } else if (!isPdfFile(file)) {
      newErrors.file = "El archivo debe ser un PDF válido.";
    }

    if (!firmanteNombre1) {
      newErrors.firmante_nombre1 = "Este campo es obligatorio.";
    }

    if (!firmanteApellido1) {
      newErrors.firmante_apellido1 = "Este campo es obligatorio.";
    }

    if (!firmanteEmail || !isValidEmail(firmanteEmail)) {
      newErrors.firmante_email = "Ingresa un correo válido.";
    }

    if (!firmanteMovil) {
      newErrors.firmante_movil = "El teléfono es obligatorio.";
    }

    if (!firmanteRunClean) {
      newErrors.firmante_run = "RUN / RUT es obligatorio.";
    } else if (firmanteRunClean.length < 8 || firmanteRunClean.length > 10) {
      newErrors.firmante_run = "RUN inválido (ej: 12.345.678-9)";
    }

    if (!destinatarioNombre) {
      newErrors.destinatario_nombre = "Este campo es obligatorio.";
    }

    if (!destinatarioEmail || !isValidEmail(destinatarioEmail)) {
      newErrors.destinatario_email = "Ingresa un correo válido.";
    }

    if (!empresaRutClean) {
      newErrors.empresa_rut = "El RUT de la empresa es obligatorio.";
    } else if (empresaRutClean.length < 8 || empresaRutClean.length > 10) {
      newErrors.empresa_rut = "RUT inválido (ej: 12.345.678-9)";
    }

    if (showVisador) {
      if (!visadorNombre) {
        newErrors.visador_nombre = "Nombre del visador obligatorio.";
      }

      if (!visadorEmail || !isValidEmail(visadorEmail)) {
        newErrors.visador_email = "Email del visador obligatorio.";
      }
    }

    const firmanteNombreCompleto = [
      firmanteNombre1,
      firmanteNombre2,
      firmanteApellido1,
      firmanteApellido2,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const signers = [];

    if (showVisador && visadorEmail) {
      signers.push({
        nombreCompleto: visadorNombre,
        email: visadorEmail,
        telefono: visadorMovil || null,
        orden: 1,
        tipo: "VISADOR",
        debe_visar: true,
        debe_firmar: false,
      });
    }

    signers.push({
      nombreCompleto: firmanteNombreCompleto,
      email: firmanteEmail,
      telefono: firmanteMovil,
      orden: showVisador ? 2 : 1,
      tipo: "FIRMANTE",
      debe_visar: false,
      debe_firmar: true,
      run: firmanteRunValue,
    });

    extraSigners.forEach((signer, index) => {
      const nombreExtra =
        (form.elements[`extra_nombre_${index}`]?.value || "").trim();
      const emailExtra =
        (form.elements[`extra_email_${index}`]?.value || "").trim();
      const movilExtra =
        (form.elements[`extra_movil_${index}`]?.value || "").trim();

      if (!nombreExtra) {
        newErrors[`extra_nombre_${index}`] = "Nombre obligatorio.";
      }

      if (!emailExtra || !isValidEmail(emailExtra)) {
        newErrors[`extra_email_${index}`] = "Email obligatorio.";
      }

      if (nombreExtra && emailExtra && isValidEmail(emailExtra)) {
        signers.push({
          nombreCompleto: nombreExtra,
          email: emailExtra,
          telefono: movilExtra || null,
          orden: signers.length + 1,
          tipo: "FIRMANTE",
          debe_visar: false,
          debe_firmar: true,
        });
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("file", file);
      formData.append("autoSendFlow", "true");
      formData.append("tipo_tramite", tipoTramite);
      formData.append("tipo_documento", tipoDocumento);
      formData.append("tipo_flujo", tipoFlujo);
      formData.append("empresa_rut", empresaRutValue);
      formData.append("destinatario_nombre", destinatarioNombre);
      formData.append("destinatario_email", destinatarioEmail);
      formData.append("requiresVisado", showVisador ? "true" : "false");
      formData.append("signers", JSON.stringify(signers));

      if (tipoTramite === "notaria") {
        formData.append("requiere_firma_notarial", "true");
      }

      const res = await api.post("/docs", formData);

      if (!res?.data) {
        throw new Error("No se pudo crear el documento en el servidor.");
      }

      setSubmitMessage("✅ Documento creado y enviado correctamente.");
      resetFormState(form);

      if (typeof cargarDocs === "function") {
        await cargarDocs();
      }

      if (typeof goToList === "function") {
        await goToList();
      }
    } catch (err) {
      console.error("Error creando documento:", err);

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Fallo en la creación del documento.";

      setSubmitMessage(`❌ ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card-premium">
      <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>
        Crear nuevo trámite
      </h1>

      <p
        style={{
          color: "#64748b",
          marginBottom: 16,
          fontSize: "1.05rem",
        }}
      >
        Configura el tipo de trámite, los participantes y carga el PDF.
      </p>

      {submitMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: submitMessage.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
            color: submitMessage.startsWith("✅") ? "#166534" : "#b91c1c",
            border: `1px solid ${
              submitMessage.startsWith("✅") ? "#bbf7d0" : "#fecaca"
            }`,
          }}
        >
          {submitMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 260 }}>
          <label
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              display: "block",
              marginBottom: 8,
            }}
          >
            Tipo de trámite
          </label>
          <select
            className="input-field"
            value={tipoTramite}
            onChange={(e) => setTipoTramite(e.target.value)}
          >
            {TIPOS_TRAMITE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 260 }}>
          <label
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              display: "block",
              marginBottom: 8,
            }}
          >
            Tipo de documento
          </label>
          <select
            className="input-field"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
          >
            <option value="">Selecciona una opción</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {formErrors.tipo_documento && (
            <p style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}>
              {formErrors.tipo_documento}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label
          style={{
            fontWeight: 700,
            fontSize: "0.9rem",
            display: "block",
            marginBottom: 8,
          }}
        >
          Tipo de flujo de firma
        </label>
        <select
          className="input-field"
          value={tipoFlujo}
          onChange={(e) => setTipoFlujo(e.target.value)}
        >
          <option value="SECUENCIAL">
            Secuencial (uno tras otro, en orden)
          </option>
          <option value="PARALELO">
            Paralelo (todos a la vez, sin orden)
          </option>
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <label
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "block",
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
                style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}
              >
                {formErrors.title}
              </p>
            )}
          </div>

          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            id="file-input-contrato"
            style={{ display: "none" }}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              setFileName(selectedFile ? selectedFile.name : "");
            }}
          />

          <div>
            <label
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "block",
                marginBottom: 8,
              }}
            >
              Archivo PDF *
            </label>
            <button
              type="button"
              className="btn-main"
              style={{
                background: "#0f766e",
                color: "#ffffff",
                padding: "10px 24px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                const input = document.getElementById("file-input-contrato");
                input?.click();
              }}
            >
              Subir contrato (PDF)
            </button>
            {fileName && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: "0.8rem",
                  color: "#64748b",
                }}
              >
                Archivo seleccionado: {fileName}
              </p>
            )}
            {formErrors.file && (
              <p
                style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}
              >
                {formErrors.file}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <label
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              display: "block",
              marginBottom: 10,
            }}
          >
            Descripción y observaciones
          </label>
          <textarea
            name="description"
            className="input-field"
            rows="4"
            placeholder="Indique detalles relevantes..."
          />
        </div>

        <div
          style={{
            background: "#f1f5f9",
            padding: 24,
            borderRadius: 22,
            marginBottom: 32,
            border: "1px solid #e2e8f0",
          }}
        >
          <label
            style={{
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              fontSize: "1.05rem",
              color: "#1e293b",
            }}
          >
            <input
              type="checkbox"
              checked={showVisador}
              onChange={(e) => setShowVisador(e.target.checked)}
              style={{ marginRight: 15, width: 22, height: 22 }}
            />
            ¿Este envío requiere la revisión previa de un visador?
          </label>

          {showVisador && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 20,
                marginTop: 24,
              }}
            >
              <div>
                <input
                  name="visador_nombre"
                  className="input-field"
                  placeholder="Nombre visador"
                />
                {formErrors.visador_nombre && (
                  <p
                    style={{
                      color: "#b91c1c",
                      fontSize: "0.8rem",
                      marginTop: 4,
                    }}
                  >
                    {formErrors.visador_nombre}
                  </p>
                )}
              </div>

              <div>
                <input
                  name="visador_email"
                  type="email"
                  className="input-field"
                  placeholder="Email visador"
                />
                {formErrors.visador_email && (
                  <p
                    style={{
                      color: "#b91c1c",
                      fontSize: "0.8rem",
                      marginTop: 4,
                    }}
                  >
                    {formErrors.visador_email}
                  </p>
                )}
              </div>

              <input
                name="visador_movil"
                className="input-field"
                placeholder="Móvil (opcional)"
              />
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          <div className="card-mini" style={{ marginTop: 0 }}>
            <h4>Firmante final</h4>
            <div className="card-content">
              <input
                name="firmante_nombre1"
                className="input-field"
                placeholder="Primer nombre *"
              />
              {formErrors.firmante_nombre1 && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
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
                placeholder="Primer apellido *"
              />
              {formErrors.firmante_apellido1 && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
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
                placeholder="Email corporativo *"
              />
              {formErrors.firmante_email && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_email}
                </p>
              )}

              <input
                name="firmante_run"
                className="input-field"
                placeholder="RUN / RUT del representante *"
                value={firmanteRunValue}
                onChange={(e) => setFirmanteRunValue(formatRunDoc(e.target.value))}
              />
              {formErrors.firmante_run && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_run}
                </p>
              )}

              <input
                name="firmante_movil"
                className="input-field"
                placeholder="Teléfono móvil del representante *"
              />
              {formErrors.firmante_movil && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
                    marginTop: 4,
                  }}
                >
                  {formErrors.firmante_movil}
                </p>
              )}
            </div>
          </div>

          <div className="card-mini" style={{ marginTop: 0 }}>
            <h4>Destinatario / empresa</h4>
            <div className="card-content">
              <input
                name="destinatario_nombre"
                className="input-field"
                placeholder="Razón social *"
              />
              {formErrors.destinatario_nombre && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
                    marginTop: 4,
                  }}
                >
                  {formErrors.destinatario_nombre}
                </p>
              )}

              <input
                name="empresa_rut"
                className="input-field"
                placeholder="RUT de la empresa *"
                value={empresaRutValue}
                onChange={(e) => setEmpresaRutValue(formatRunDoc(e.target.value))}
              />
              {formErrors.empresa_rut && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
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
                placeholder="Email de contacto *"
              />
              {formErrors.destinatario_email && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.8rem",
                    marginTop: 4,
                  }}
                >
                  {formErrors.destinatario_email}
                </p>
              )}
            </div>
          </div>
        </div>

        {extraSigners.map((signer, index) => (
          <div key={signer.id} className="card-mini">
            <h4>
              <span>Firmante adicional #{index + 1}</span>
              <button
                type="button"
                onClick={() => removeExtraSigner(signer.id)}
                style={{
                  color: "#ef4444",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                }}
              >
                Eliminar
              </button>
            </h4>

            <div
              className="card-content"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 20,
              }}
            >
              <div>
                <input
                  name={`extra_nombre_${index}`}
                  className="input-field"
                  placeholder="Nombre completo *"
                />
                {formErrors[`extra_nombre_${index}`] && (
                  <p
                    style={{
                      color: "#b91c1c",
                      fontSize: "0.8rem",
                      marginTop: 4,
                    }}
                  >
                    {formErrors[`extra_nombre_${index}`]}
                  </p>
                )}
              </div>

              <div>
                <input
                  name={`extra_email_${index}`}
                  type="email"
                  className="input-field"
                  placeholder="Email *"
                />
                {formErrors[`extra_email_${index}`] && (
                  <p
                    style={{
                      color: "#b91c1c",
                      fontSize: "0.8rem",
                      marginTop: 4,
                    }}
                  >
                    {formErrors[`extra_email_${index}`]}
                  </p>
                )}
              </div>

              <input
                name={`extra_movil_${index}`}
                className="input-field"
                placeholder="Móvil"
              />
            </div>
          </div>
        ))}

        <div
          style={{
            marginTop: 32,
            display: "flex",
            gap: 16,
            borderTop: "1px solid #f1f5f9",
            paddingTop: 24,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn-main"
            onClick={addExtraSigner}
            style={{
              background: "#e2e8f0",
              color: "#475569",
              padding: "12px 26px",
            }}
          >
            + Añadir firmante adicional
          </button>

          <button
            type="submit"
            className="btn-main btn-primary"
            disabled={submitting}
            style={{
              padding: "12px 80px",
              fontSize: "1rem",
              flexGrow: 1,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Enviando..." : "Iniciar flujo de firma digital"}
          </button>
        </div>
      </form>
    </div>
  );
}