import React, { useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import { getProcedureLabel } from "../utils/documentLabels";
import "../styles/newDocumentForm.css";

const TIPOS_TRAMITE = [
  { value: "propio", labelKey: "newDocument.options.tipoTramite.propio", fallback: "Sin notaría" },
  { value: "notaria", labelKey: "newDocument.options.tipoTramite.notaria", fallback: "Con notaría" },
];

const TIPOS_DOCUMENTO = [
  { value: "poder", labelKey: "newDocument.options.tipoDocumento.poder", fallback: "Poder" },
  { value: "contrato", labelKey: "newDocument.options.tipoDocumento.contrato", fallback: "Contrato" },
  { value: "autorizacion", labelKey: "newDocument.options.tipoDocumento.autorizacion", fallback: "Autorización" },
];

const TIPOS_FLUJO = [
  {
    value: "SECUENCIAL",
    labelKey: "newDocument.options.tipoFlujo.secuencial",
    fallback: "Secuencial (uno tras otro, en orden)",
  },
  {
    value: "PARALELO",
    labelKey: "newDocument.options.tipoFlujo.paralelo",
    fallback: "Paralelo (todos a la vez, sin orden)",
  },
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

function readValue(form, name) {
  return (form.elements[name]?.value || "").trim();
}

function buildSignerFullName(...parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function cleanRut(value) {
  return String(value || "").replace(/[^0-9kK]/g, "");
}

function getFieldErrorProps(name, errors) {
  const hasError = Boolean(errors[name]);

  return {
    "aria-invalid": hasError ? "true" : "false",
    "aria-describedby": hasError ? `${name}-error` : undefined,
  };
}

function FieldError({ name, errors }) {
  if (!errors[name]) return null;

  return (
    <p id={`${name}-error`} className="form-field-error" role="alert">
      {errors[name]}
    </p>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div className="new-doc-section__heading">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
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
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [tipoDocumento, setTipoDocumento] = useState("");
  const [tipoFlujo, setTipoFlujo] = useState("SECUENCIAL");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");

  const fileName = selectedFile?.name || "";

  const resumenTipo = useMemo(() => {
    return getProcedureLabel({
      tipo_tramite: tipoTramite,
      tipo_documento: tipoDocumento,
    });
  }, [tipoTramite, tipoDocumento]);

  const resetFormState = useCallback(
    (form) => {
      form.reset();
      setShowVisador(false);
      setExtraSigners([]);
      setFirmanteRunValue("");
      setEmpresaRutValue("");
      setTipoDocumento("");
      setTipoFlujo("SECUENCIAL");
      setSelectedFile(null);
      setFormErrors({});
      setSubmitMessage("");
      setSubmitStatus("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [
      setShowVisador,
      setExtraSigners,
      setFirmanteRunValue,
      setEmpresaRutValue,
      setFormErrors,
    ]
  );

  const addExtraSigner = useCallback(() => {
    setExtraSigners((prev) => [...prev, { id: Date.now() + Math.random() }]);
  }, [setExtraSigners]);

  const removeExtraSigner = useCallback(
    (id) => {
      const nextSigners = extraSigners.filter((signer) => signer.id !== id);

      setExtraSigners(nextSigners);

      setFormErrors((prev) => {
        const next = { ...prev };

        Object.keys(next).forEach((key) => {
          if (
            key.startsWith("extra_nombre_") ||
            key.startsWith("extra_email_") ||
            key.startsWith("extra_movil_")
          ) {
            delete next[key];
          }
        });

        nextSigners.forEach((_, index) => {
          const oldNameKey = `extra_nombre_${index}`;
          const oldEmailKey = `extra_email_${index}`;
          const oldMovilKey = `extra_movil_${index}`;

          if (prev[oldNameKey]) next[oldNameKey] = prev[oldNameKey];
          if (prev[oldEmailKey]) next[oldEmailKey] = prev[oldEmailKey];
          if (prev[oldMovilKey]) next[oldMovilKey] = prev[oldMovilKey];
        });

        return next;
      });
    },
    [extraSigners, setExtraSigners, setFormErrors]
  );

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0] || null;
      setSelectedFile(file);

      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.file;
        return next;
      });
    },
    [setFormErrors]
  );

  const validateForm = useCallback(
    (form) => {
      const newErrors = {};

      const titleRaw = readValue(form, "title");
      const description = readValue(form, "description");
      const file = selectedFile;

      const firmanteNombre1 = readValue(form, "firmante_nombre1");
      const firmanteNombre2 = readValue(form, "firmante_nombre2");
      const firmanteApellido1 = readValue(form, "firmante_apellido1");
      const firmanteApellido2 = readValue(form, "firmante_apellido2");
      const firmanteEmail = readValue(form, "firmante_email");
      const firmanteMovil = readValue(form, "firmante_movil");

      const destinatarioNombre = readValue(form, "destinatario_nombre");
      const destinatarioEmail = readValue(form, "destinatario_email");

      const visadorNombre = readValue(form, "visador_nombre");
      const visadorEmail = readValue(form, "visador_email");
      const visadorMovil = readValue(form, "visador_movil");

      const firmanteRunClean = cleanRut(firmanteRunValue);
      const empresaRutClean = cleanRut(empresaRutValue);

      if (!tipoTramite) {
        newErrors.tipo_tramite = t(
          "newDocument.errors.tipoTramiteRequired",
          "Selecciona si el trámite es con o sin notaría."
        );
      }

      if (!tipoDocumento) {
        newErrors.tipo_documento = t(
          "newDocument.errors.tipoDocumentoRequired",
          "Selecciona el tipo de documento."
        );
      }

      const title =
        titleRaw || (file?.name || "").replace(/\.pdf$/i, "").trim();

      if (!title || title.length < 2) {
        newErrors.title = t(
          "newDocument.errors.titleTooShort",
          "El título debe tener al menos 2 caracteres."
        );
      } else if (title.length > 255) {
        newErrors.title = t(
          "newDocument.errors.titleTooLong",
          "El título no puede superar 255 caracteres."
        );
      }

      if (!file) {
        newErrors.file = t(
          "newDocument.errors.fileRequired",
          "Adjunta un archivo PDF."
        );
      } else if (!isPdfFile(file)) {
        newErrors.file = t(
          "newDocument.errors.fileInvalid",
          "El archivo debe ser un PDF válido."
        );
      }

      if (!firmanteNombre1) {
        newErrors.firmante_nombre1 = t(
          "newDocument.errors.required",
          "Este campo es obligatorio."
        );
      }

      if (!firmanteApellido1) {
        newErrors.firmante_apellido1 = t(
          "newDocument.errors.required",
          "Este campo es obligatorio."
        );
      }

      if (!firmanteEmail || !isValidEmail(firmanteEmail)) {
        newErrors.firmante_email = t(
          "newDocument.errors.invalidEmail",
          "Ingresa un correo válido."
        );
      }

      if (!firmanteMovil) {
        newErrors.firmante_movil = t(
          "newDocument.errors.mobileRequired",
          "El teléfono es obligatorio."
        );
      }

      if (!firmanteRunClean) {
        newErrors.firmante_run = t(
          "newDocument.errors.runRequired",
          "RUN / RUT es obligatorio."
        );
      } else if (firmanteRunClean.length < 8 || firmanteRunClean.length > 10) {
        newErrors.firmante_run = t(
          "newDocument.errors.runInvalid",
          "RUN inválido (ej: 12.345.678-9)."
        );
      }

      if (!destinatarioNombre) {
        newErrors.destinatario_nombre = t(
          "newDocument.errors.required",
          "Este campo es obligatorio."
        );
      }

      if (!destinatarioEmail || !isValidEmail(destinatarioEmail)) {
        newErrors.destinatario_email = t(
          "newDocument.errors.invalidEmail",
          "Ingresa un correo válido."
        );
      }

      if (!empresaRutClean) {
        newErrors.empresa_rut = t(
          "newDocument.errors.companyRutRequired",
          "El RUT de la empresa es obligatorio."
        );
      } else if (empresaRutClean.length < 8 || empresaRutClean.length > 10) {
        newErrors.empresa_rut = t(
          "newDocument.errors.companyRutInvalid",
          "RUT inválido (ej: 12.345.678-9)."
        );
      }

      if (showVisador) {
        if (!visadorNombre) {
          newErrors.visador_nombre = t(
            "newDocument.errors.visadorNameRequired",
            "Nombre del visador obligatorio."
          );
        }

        if (!visadorEmail || !isValidEmail(visadorEmail)) {
          newErrors.visador_email = t(
            "newDocument.errors.visadorEmailRequired",
            "Email del visador obligatorio."
          );
        }
      }

      const firmanteNombreCompleto = buildSignerFullName(
        firmanteNombre1,
        firmanteNombre2,
        firmanteApellido1,
        firmanteApellido2
      );

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
        const nombreExtra = readValue(form, `extra_nombre_${index}`);
        const emailExtra = readValue(form, `extra_email_${index}`);
        const movilExtra = readValue(form, `extra_movil_${index}`);

        if (!nombreExtra) {
          newErrors[`extra_nombre_${index}`] = t(
            "newDocument.errors.extraSignerNameRequired",
            "Nombre obligatorio."
          );
        }

        if (!emailExtra || !isValidEmail(emailExtra)) {
          newErrors[`extra_email_${index}`] = t(
            "newDocument.errors.extraSignerEmailRequired",
            "Email obligatorio."
          );
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

      return {
        errors: newErrors,
        values: {
          title,
          description,
          file,
          destinatarioNombre,
          destinatarioEmail,
          signers,
        },
      };
    },
    [
      extraSigners,
      firmanteRunValue,
      empresaRutValue,
      selectedFile,
      showVisador,
      t,
      tipoDocumento,
      tipoTramite,
    ]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormErrors({});
      setSubmitMessage("");
      setSubmitStatus("");
      setSubmitting(true);

      const form = event.currentTarget;
      const { errors, values } = validateForm(form);

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setSubmitting(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("title", values.title);
        formData.append("description", values.description);
        formData.append("file", values.file);
        formData.append("autoSendFlow", "true");
        formData.append("tipo_tramite", tipoTramite);
        formData.append("tipo_documento", tipoDocumento);
        formData.append("tipo_flujo", tipoFlujo);
        formData.append("empresa_rut", empresaRutValue);
        formData.append("destinatario_nombre", values.destinatarioNombre);
        formData.append("destinatario_email", values.destinatarioEmail);
        formData.append("requiresVisado", showVisador ? "true" : "false");
        formData.append("signers", JSON.stringify(values.signers));

        if (tipoTramite === "notaria") {
          formData.append("requiere_firma_notarial", "true");
        }

        const res = await api.post("/docs", formData);

        if (!res?.data) {
          throw new Error(
            t(
              "newDocument.errors.serverNoData",
              "No se pudo crear el documento en el servidor."
            )
          );
        }

        setSubmitStatus("success");
        setSubmitMessage(
          t(
            "newDocument.messages.success",
            "Documento creado y enviado correctamente."
          )
        );

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
          t(
            "newDocument.errors.genericSubmit",
            "Fallo en la creación del documento."
          );

        setSubmitStatus("error");
        setSubmitMessage(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      cargarDocs,
      empresaRutValue,
      goToList,
      resetFormState,
      setFormErrors,
      showVisador,
      t,
      tipoDocumento,
      tipoFlujo,
      tipoTramite,
      validateForm,
    ]
  );

  return (
    <section className="card-premium new-document-form">
      <header className="new-document-form__header">
        <h1 className="new-document-form__title">
          {t("newDocument.title", "Crear nuevo documento")}
        </h1>
        <p className="new-document-form__subtitle">
          {t(
            "newDocument.subtitle",
            "Define el tipo de documento, los participantes y carga el PDF para iniciar el flujo."
          )}
        </p>
      </header>

      {submitMessage ? (
        <div
          className={`form-submit-banner ${
            submitStatus === "success"
              ? "form-submit-banner--success"
              : "form-submit-banner--error"
          }`}
          role="status"
          aria-live="polite"
        >
          {submitStatus === "success" ? "✅ " : "❌ "}
          {submitMessage}
        </div>
      ) : null}

      <div className="new-document-summary">
        {t("newDocument.summaryLabel", "Clasificación actual")}:{" "}
        <strong>{resumenTipo}</strong>
      </div>

      <div className="new-document-grid new-document-grid--top">
        <div className="form-field">
          <label htmlFor="tipo_tramite">
            {t("newDocument.fields.tipoTramite", "Trámite")}
          </label>
          <select
            id="tipo_tramite"
            className="input-field"
            value={tipoTramite}
            onChange={(e) => setTipoTramite(e.target.value)}
            {...getFieldErrorProps("tipo_tramite", formErrors)}
          >
            <option value="">
              {t("newDocument.placeholders.selectOption", "Selecciona una opción")}
            </option>
            {TIPOS_TRAMITE.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {t(tipo.labelKey, tipo.fallback)}
              </option>
            ))}
          </select>
          <FieldError name="tipo_tramite" errors={formErrors} />
        </div>

        <div className="form-field">
          <label htmlFor="tipo_documento">
            {t("newDocument.fields.tipoDocumento", "Documento")}
          </label>
          <select
            id="tipo_documento"
            className="input-field"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            {...getFieldErrorProps("tipo_documento", formErrors)}
          >
            <option value="">
              {t("newDocument.placeholders.selectOption", "Selecciona una opción")}
            </option>
            {TIPOS_DOCUMENTO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {t(tipo.labelKey, tipo.fallback)}
              </option>
            ))}
          </select>
          <FieldError name="tipo_documento" errors={formErrors} />
        </div>

        <div className="form-field form-field--full">
          <label htmlFor="tipo_flujo">
            {t("newDocument.fields.tipoFlujo", "Tipo de flujo de firma")}
          </label>
          <select
            id="tipo_flujo"
            className="input-field"
            value={tipoFlujo}
            onChange={(e) => setTipoFlujo(e.target.value)}
          >
            {TIPOS_FLUJO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {t(tipo.labelKey, tipo.fallback)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <section className="new-doc-section">
          <SectionTitle
            title={t("newDocument.sections.document.title", "Documento")}
            description={t(
              "newDocument.sections.document.description",
              "Define el nombre, adjunta el PDF y agrega observaciones si corresponde."
            )}
          />

          <div className="new-document-upload-row">
            <div className="form-field new-document-upload-row__title">
              <label htmlFor="title">
                {t("newDocument.fields.title", "Nombre del documento")} *
              </label>
              <input
                id="title"
                name="title"
                className="input-field"
                placeholder={t(
                  "newDocument.placeholders.title",
                  "Ej: Contrato de prestación de servicios"
                )}
                {...getFieldErrorProps("title", formErrors)}
              />
              <FieldError name="title" errors={formErrors} />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              id="file-input-contrato"
              hidden
              onChange={handleFileChange}
            />

            <div className="form-field new-document-upload-row__file">
              <label htmlFor="file-input-contrato">
                {t("newDocument.fields.file", "Archivo PDF")} *
              </label>
              <button
                type="button"
                className="btn-main btn-primary"
                onClick={() => fileInputRef.current?.click()}
                aria-describedby={formErrors.file ? "file-error" : undefined}
              >
                {t("newDocument.actions.uploadPdf", "Subir PDF")}
              </button>

              {fileName ? (
                <p className="file-selected-text">
                  {t("newDocument.messages.selectedFile", "Archivo seleccionado")}: {fileName}
                </p>
              ) : null}

              <FieldError name="file" errors={formErrors} />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="description">
              {t("newDocument.fields.description", "Descripción y observaciones")}
            </label>
            <textarea
              id="description"
              name="description"
              className="input-field"
              rows="4"
              placeholder={t(
                "newDocument.placeholders.description",
                "Indique detalles relevantes..."
              )}
            />
          </div>
        </section>

        <section className="new-doc-section new-doc-section--soft">
          <label className="visador-toggle">
            <input
              type="checkbox"
              checked={showVisador}
              onChange={(e) => setShowVisador(e.target.checked)}
            />
            <span>
              {t(
                "newDocument.fields.requiresVisador",
                "¿Este envío requiere revisión previa de un visador?"
              )}
            </span>
          </label>

          {showVisador ? (
            <div className="new-document-grid">
              <div className="form-field">
                <label htmlFor="visador_nombre">
                  {t("newDocument.fields.visadorNombre", "Nombre del visador")} *
                </label>
                <input
                  id="visador_nombre"
                  name="visador_nombre"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.visadorNombre", "Nombre visador")}
                  {...getFieldErrorProps("visador_nombre", formErrors)}
                />
                <FieldError name="visador_nombre" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="visador_email">
                  {t("newDocument.fields.visadorEmail", "Email del visador")} *
                </label>
                <input
                  id="visador_email"
                  name="visador_email"
                  type="email"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.visadorEmail", "Email visador")}
                  {...getFieldErrorProps("visador_email", formErrors)}
                />
                <FieldError name="visador_email" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="visador_movil">
                  {t("newDocument.fields.visadorMovil", "Móvil del visador")}
                </label>
                <input
                  id="visador_movil"
                  name="visador_movil"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.visadorMovil", "Móvil (opcional)")}
                />
              </div>
            </div>
          ) : null}
        </section>

        <div className="new-document-grid new-document-grid--cards">
          <section className="card-mini">
            <h4>{t("newDocument.sections.mainSigner", "Firmante principal")}</h4>

            <div className="card-content">
              <div className="form-field">
                <label htmlFor="firmante_nombre1">
                  {t("newDocument.fields.firstName", "Primer nombre")} *
                </label>
                <input
                  id="firmante_nombre1"
                  name="firmante_nombre1"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.firstName", "Primer nombre")}
                  {...getFieldErrorProps("firmante_nombre1", formErrors)}
                />
                <FieldError name="firmante_nombre1" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_nombre2">
                  {t("newDocument.fields.secondName", "Segundo nombre")}
                </label>
                <input
                  id="firmante_nombre2"
                  name="firmante_nombre2"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.secondName", "Segundo nombre")}
                />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_apellido1">
                  {t("newDocument.fields.firstSurname", "Primer apellido")} *
                </label>
                <input
                  id="firmante_apellido1"
                  name="firmante_apellido1"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.firstSurname", "Primer apellido")}
                  {...getFieldErrorProps("firmante_apellido1", formErrors)}
                />
                <FieldError name="firmante_apellido1" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_apellido2">
                  {t("newDocument.fields.secondSurname", "Segundo apellido")}
                </label>
                <input
                  id="firmante_apellido2"
                  name="firmante_apellido2"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.secondSurname", "Segundo apellido")}
                />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_email">
                  {t("newDocument.fields.corporateEmail", "Email corporativo")} *
                </label>
                <input
                  id="firmante_email"
                  name="firmante_email"
                  type="email"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.corporateEmail", "Email corporativo")}
                  {...getFieldErrorProps("firmante_email", formErrors)}
                />
                <FieldError name="firmante_email" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_run">
                  {t("newDocument.fields.signerRun", "RUN / RUT del representante")} *
                </label>
                <input
                  id="firmante_run"
                  name="firmante_run"
                  className="input-field"
                  placeholder={t(
                    "newDocument.placeholders.signerRun",
                    "RUN / RUT del representante"
                  )}
                  value={firmanteRunValue}
                  onChange={(e) => setFirmanteRunValue(formatRunDoc(e.target.value))}
                  {...getFieldErrorProps("firmante_run", formErrors)}
                />
                <FieldError name="firmante_run" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="firmante_movil">
                  {t("newDocument.fields.mobile", "Teléfono móvil")} *
                </label>
                <input
                  id="firmante_movil"
                  name="firmante_movil"
                  className="input-field"
                  placeholder={t(
                    "newDocument.placeholders.mobile",
                    "Teléfono móvil del representante"
                  )}
                  {...getFieldErrorProps("firmante_movil", formErrors)}
                />
                <FieldError name="firmante_movil" errors={formErrors} />
              </div>
            </div>
          </section>

          <section className="card-mini">
            <h4>{t("newDocument.sections.recipient", "Destinatario / empresa")}</h4>

            <div className="card-content">
              <div className="form-field">
                <label htmlFor="destinatario_nombre">
                  {t("newDocument.fields.companyName", "Razón social")} *
                </label>
                <input
                  id="destinatario_nombre"
                  name="destinatario_nombre"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.companyName", "Razón social")}
                  {...getFieldErrorProps("destinatario_nombre", formErrors)}
                />
                <FieldError name="destinatario_nombre" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="empresa_rut">
                  {t("newDocument.fields.companyRut", "RUT de la empresa")} *
                </label>
                <input
                  id="empresa_rut"
                  name="empresa_rut"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.companyRut", "RUT de la empresa")}
                  value={empresaRutValue}
                  onChange={(e) => setEmpresaRutValue(formatRunDoc(e.target.value))}
                  {...getFieldErrorProps("empresa_rut", formErrors)}
                />
                <FieldError name="empresa_rut" errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor="destinatario_email">
                  {t("newDocument.fields.contactEmail", "Email de contacto")} *
                </label>
                <input
                  id="destinatario_email"
                  name="destinatario_email"
                  type="email"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.contactEmail", "Email de contacto")}
                  {...getFieldErrorProps("destinatario_email", formErrors)}
                />
                <FieldError name="destinatario_email" errors={formErrors} />
              </div>
            </div>
          </section>
        </div>

        {extraSigners.map((signer, index) => (
          <section key={signer.id} className="card-mini">
            <h4 className="card-mini__header">
              <span>
                {t("newDocument.sections.extraSigner", "Firmante adicional")} #{index + 1}
              </span>
              <button
                type="button"
                className="btn-link-danger"
                onClick={() => removeExtraSigner(signer.id)}
              >
                {t("newDocument.actions.remove", "Eliminar")}
              </button>
            </h4>

            <div className="card-content new-document-grid">
              <div className="form-field">
                <label htmlFor={`extra_nombre_${index}`}>
                  {t("newDocument.fields.fullName", "Nombre completo")} *
                </label>
                <input
                  id={`extra_nombre_${index}`}
                  name={`extra_nombre_${index}`}
                  className="input-field"
                  placeholder={t("newDocument.placeholders.fullName", "Nombre completo")}
                  {...getFieldErrorProps(`extra_nombre_${index}`, formErrors)}
                />
                <FieldError name={`extra_nombre_${index}`} errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor={`extra_email_${index}`}>
                  {t("newDocument.fields.email", "Email")} *
                </label>
                <input
                  id={`extra_email_${index}`}
                  name={`extra_email_${index}`}
                  type="email"
                  className="input-field"
                  placeholder={t("newDocument.placeholders.email", "Email")}
                  {...getFieldErrorProps(`extra_email_${index}`, formErrors)}
                />
                <FieldError name={`extra_email_${index}`} errors={formErrors} />
              </div>

              <div className="form-field">
                <label htmlFor={`extra_movil_${index}`}>
                  {t("newDocument.fields.optionalMobile", "Móvil")}
                </label>
                <input
                  id={`extra_movil_${index}`}
                  name={`extra_movil_${index}`}
                  className="input-field"
                  placeholder={t("newDocument.placeholders.optionalMobile", "Móvil")}
                />
              </div>
            </div>
          </section>
        ))}

        <div className="new-document-form__actions">
          <button
            type="button"
            className="btn-main btn-ghost"
            onClick={addExtraSigner}
            disabled={submitting}
          >
            {t("newDocument.actions.addExtraSigner", "+ Añadir firmante adicional")}
          </button>

          <button
            type="submit"
            className="btn-main btn-primary"
            disabled={submitting}
          >
            {submitting
              ? t("newDocument.actions.submitting", "Enviando...")
              : t("newDocument.actions.submit", "Iniciar flujo de firma digital")}
          </button>
        </div>
      </form>
    </section>
  );
}