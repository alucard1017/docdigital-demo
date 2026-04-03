// frontend/src/views/ProfileView.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const initialProfileState = {
  id: null,
  run: "",
  email: "",
  name: "",
  role: "",
  company_id: null,
  email_verified: false,
  email_verified_at: null,
  created_at: null,
};

const initialProfileForm = {
  name: "",
  email: "",
};

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfileView() {
  const [profile, setProfile] = useState(initialProfileState);
  const [companyName, setCompanyName] = useState("");
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setProfileError("");
        setProfileSuccess("");

        const res = await api.get("/users/profile", {
          signal: controller.signal,
        });

        const data = res?.data || {};
        const nextProfile = {
          id: data.id ?? null,
          run: data.run ?? "",
          email: data.email ?? "",
          name: data.name ?? "",
          role: data.role ?? "",
          company_id: data.company_id ?? null,
          email_verified: data.email_verified ?? false,
          email_verified_at: data.email_verified_at ?? null,
          created_at: data.created_at ?? null,
        };

        setProfile(nextProfile);
        setProfileForm({
          name: nextProfile.name || "",
          email: nextProfile.email || "",
        });
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;

        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "No se pudo cargar tu perfil.";
        setProfileError(msg);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profile.company_id) {
      setCompanyName("");
      setLoadingCompany(false);
      return;
    }

    const controller = new AbortController();

    async function loadCompanyName() {
      try {
        setLoadingCompany(true);

        const res = await api.get(`/companies/${profile.company_id}`, {
          signal: controller.signal,
        });

        setCompanyName(res?.data?.name || `ID ${profile.company_id}`);
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setCompanyName(`ID ${profile.company_id}`);
      } finally {
        setLoadingCompany(false);
      }
    }

    loadCompanyName();

    return () => controller.abort();
  }, [profile.company_id]);

  const emailStatus = useMemo(() => {
    return profile.email_verified
      ? { label: "Correo verificado", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" }
      : { label: "Correo no verificado", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" };
  }, [profile.email_verified]);

  const passwordStrength = useMemo(() => {
    const value = passwordForm.newPassword || "";
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    if (!value) return { label: "Sin definir", color: "#94a3b8", width: "0%" };
    if (score <= 1) return { label: "Débil", color: "#dc2626", width: "25%" };
    if (score <= 3) return { label: "Media", color: "#d97706", width: "60%" };
    return { label: "Fuerte", color: "#16a34a", width: "100%" };
  }, [passwordForm.newPassword]);

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateProfileForm() {
    const errors = {};
    const name = profileForm.name.trim();
    const email = profileForm.email.trim().toLowerCase();

    if (!name) errors.name = "El nombre no puede estar vacío.";
    if (!email) errors.email = "El correo electrónico es obligatorio.";
    else if (!validateEmail(email)) errors.email = "Ingresa un correo válido.";

    return errors;
  }

  function validatePasswordForm() {
    const errors = {};
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword) errors.currentPassword = "Ingresa tu contraseña actual.";
    if (!newPassword) errors.newPassword = "Ingresa una nueva contraseña.";
    else if (newPassword.length < 6) {
      errors.newPassword = "La nueva contraseña debe tener al menos 6 caracteres.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirma la nueva contraseña.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "La confirmación no coincide.";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = "La nueva contraseña no debe ser igual a la actual.";
    }

    return errors;
  }

  function resetProfileMessages() {
    setProfileError("");
    setProfileSuccess("");
  }

  function resetPasswordMessages() {
    setPasswordError("");
    setPasswordSuccess("");
  }

  function handleProfileFieldChange(field, value) {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setProfileFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

    resetProfileMessages();
  }

  function handlePasswordFieldChange(field, value) {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setPasswordFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

    resetPasswordMessages();
  }

  async function handleSaveProfile(e) {
    e.preventDefault();

    const errors = validateProfileForm();
    setProfileFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setProfileError("Revisa los campos marcados.");
      setProfileSuccess("");
      return;
    }

    const payload = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim().toLowerCase(),
    };

    try {
      setSavingProfile(true);
      resetProfileMessages();

      const res = await api.put("/users/profile", payload);
      const updated = res?.data?.user || {};

      setProfile((prev) => ({
        ...prev,
        name: updated.name ?? payload.name,
        email: updated.email ?? payload.email,
        email_verified: updated.email_verified ?? prev.email_verified,
      }));

      setProfileForm({
        name: updated.name ?? payload.name,
        email: updated.email ?? payload.email,
      });

      setProfileSuccess(res?.data?.message || "Perfil actualizado correctamente.");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo actualizar el perfil.";
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    const errors = validatePasswordForm();
    setPasswordFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setPasswordError("Revisa los campos de contraseña.");
      setPasswordSuccess("");
      return;
    }

    try {
      setChangingPassword(true);
      resetPasswordMessages();

      await api.post("/users/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordSuccess("Contraseña actualizada correctamente.");
      setPasswordForm(initialPasswordForm);
      setPasswordFieldErrors({});
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo cambiar la contraseña.";
      setPasswordError(msg);
    } finally {
      setChangingPassword(false);
    }
  }

  function handleResetProfile() {
    setProfileForm({
      name: profile.name || "",
      email: profile.email || "",
    });
    setProfileFieldErrors({});
    resetProfileMessages();
  }

  if (loadingProfile) {
    return (
      <div className="dashboard-section">
        <div className="dashboard-page-header">
          <div>
            <h1>Mi perfil</h1>
            <p>Cargando tu información…</p>
          </div>
        </div>

        <div style={loadingCardStyle}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          <div>Conectando con el servidor seguro…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <div className="dashboard-page-header">
        <div>
          <h1>Mi perfil</h1>
          <p>
            Administra tus datos de acceso, el correo de la cuenta y la seguridad de tu usuario.
          </p>
        </div>
      </div>

      <div style={layoutGridStyle}>
        <section style={mainCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Datos de la cuenta</h2>
              <p style={sectionTextStyle}>
                Estos datos identifican tu usuario dentro de la plataforma.
              </p>
            </div>

            <div style={pillStyle(emailStatus.bg, emailStatus.border, emailStatus.color)}>
              {emailStatus.label}
            </div>
          </div>

          {profileError ? (
            <AlertBox type="error">{profileError}</AlertBox>
          ) : null}

          {profileSuccess ? (
            <AlertBox type="success">{profileSuccess}</AlertBox>
          ) : null}

          <form onSubmit={handleSaveProfile}>
            <Field
              id="profile-run"
              label="RUN"
              helpText="Este identificador no se puede modificar desde esta vista."
            >
              <input
                id="profile-run"
                type="text"
                value={profile.run || ""}
                readOnly
                style={inputStyle({ readOnly: true })}
              />
            </Field>

            <Field
              id="profile-email"
              label="Correo electrónico"
              error={profileFieldErrors.email}
              helpText={
                profile.email_verified
                  ? "Tu correo actual está verificado."
                  : "Si cambias el correo, quedará pendiente de verificación."
              }
            >
              <input
                id="profile-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => handleProfileFieldChange("email", e.target.value)}
                style={inputStyle({ hasError: !!profileFieldErrors.email })}
                aria-invalid={!!profileFieldErrors.email}
              />
            </Field>

            <Field
              id="profile-name"
              label="Nombre para mostrar"
              error={profileFieldErrors.name}
              helpText="Este nombre se usa en la interfaz y en registros internos."
            >
              <input
                id="profile-name"
                type="text"
                value={profileForm.name}
                onChange={(e) => handleProfileFieldChange("name", e.target.value)}
                style={inputStyle({ hasError: !!profileFieldErrors.name })}
                aria-invalid={!!profileFieldErrors.name}
              />
            </Field>

            <div style={buttonRowStyle}>
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-main btn-primary"
              >
                {savingProfile ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                type="button"
                disabled={savingProfile}
                className="btn-main btn-ghost"
                onClick={handleResetProfile}
              >
                Deshacer cambios
              </button>
            </div>
          </form>
        </section>

        <section style={sideColumnStyle}>
          <div style={sideCardStyle}>
            <h3 style={sideTitleStyle}>Información adicional</h3>

            <InfoRow label="Rol actual" value={profile.role || "No asignado"} />
            <InfoRow
              label="Empresa asociada"
              value={
                profile.company_id
                  ? loadingCompany
                    ? "Cargando empresa…"
                    : companyName || `ID ${profile.company_id}`
                  : "Sin empresa asociada"
              }
            />
            <InfoRow
              label="Correo verificado"
              value={profile.email_verified ? "Sí" : "No"}
            />
            <InfoRow
              label="Miembro desde"
              value={formatDate(profile.created_at)}
            />

            <p style={mutedParagraphStyle}>
              Los cambios de rol, empresa y asignaciones se gestionan desde el panel de administración.
            </p>
          </div>

          <div style={sideCardStyle}>
            <div style={securityHeaderStyle}>
              <h3 style={sideTitleStyle}>Seguridad</h3>
              <button
                type="button"
                className="btn-main btn-ghost"
                onClick={() => {
                  setShowPasswordForm((prev) => !prev);
                  setPasswordFieldErrors({});
                  resetPasswordMessages();
                }}
              >
                {showPasswordForm ? "Ocultar" : "Cambiar contraseña"}
              </button>
            </div>

            {showPasswordForm ? (
              <form onSubmit={handleChangePassword}>
                {passwordError ? <AlertBox type="error">{passwordError}</AlertBox> : null}
                {passwordSuccess ? <AlertBox type="success">{passwordSuccess}</AlertBox> : null}

                <PasswordField
                  id="current-password"
                  label="Contraseña actual"
                  value={passwordForm.currentPassword}
                  onChange={(value) => handlePasswordFieldChange("currentPassword", value)}
                  error={passwordFieldErrors.currentPassword}
                  visible={showCurrentPassword}
                  onToggleVisibility={() => setShowCurrentPassword((v) => !v)}
                  autoComplete="current-password"
                />

                <PasswordField
                  id="new-password"
                  label="Nueva contraseña"
                  value={passwordForm.newPassword}
                  onChange={(value) => handlePasswordFieldChange("newPassword", value)}
                  error={passwordFieldErrors.newPassword}
                  visible={showNewPassword}
                  onToggleVisibility={() => setShowNewPassword((v) => !v)}
                  autoComplete="new-password"
                  helpText="Usa letras, números y símbolos para una contraseña más fuerte."
                />

                <div style={{ marginTop: -6, marginBottom: 14 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "#e5e7eb",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: passwordStrength.width,
                        background: passwordStrength.color,
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "0.8rem",
                      color: passwordStrength.color,
                      fontWeight: 600,
                    }}
                  >
                    Seguridad de contraseña: {passwordStrength.label}
                  </p>
                </div>

                <PasswordField
                  id="confirm-password"
                  label="Confirmar nueva contraseña"
                  value={passwordForm.confirmPassword}
                  onChange={(value) => handlePasswordFieldChange("confirmPassword", value)}
                  error={passwordFieldErrors.confirmPassword}
                  visible={showConfirmPassword}
                  onToggleVisibility={() => setShowConfirmPassword((v) => !v)}
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-main btn-primary"
                >
                  {changingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </form>
            ) : (
              <p style={mutedParagraphStyle}>
                Te recomendamos actualizar tu contraseña periódicamente y no reutilizarla en otros servicios.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ id, label, error, helpText, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontWeight: 700,
          marginBottom: 6,
          fontSize: "0.92rem",
          color: "#0f172a",
        }}
      >
        {label}
      </label>

      {children}

      {error ? (
        <p style={fieldErrorStyle} role="alert">
          {error}
        </p>
      ) : helpText ? (
        <p style={fieldHelpStyle}>{helpText}</p>
      ) : null}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  visible,
  onToggleVisibility,
  autoComplete,
  helpText,
}) {
  return (
    <Field id={id} label={label} error={error} helpText={helpText}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle({ hasError: !!error })}
          aria-invalid={!!error}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="btn-main btn-ghost"
          style={{ whiteSpace: "nowrap" }}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </Field>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #eef2f7",
        fontSize: "0.92rem",
      }}
    >
      <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#0f172a", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function AlertBox({ type = "error", children }) {
  const map = {
    error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
    success: { bg: "#ecfdf5", border: "#bbf7d0", color: "#166534" },
  };

  const tone = map[type] || map.error;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "10px 12px",
        borderRadius: 12,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: "0.9rem",
      }}
      role="alert"
    >
      {children}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Date(value).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Sin fecha";
  }
}

function inputStyle({ readOnly = false, hasError = false } = {}) {
  return {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: `1px solid ${hasError ? "#fca5a5" : "#d1d5db"}`,
    background: readOnly ? "#f8fafc" : "#ffffff",
    color: "#111827",
    outline: "none",
    fontSize: "0.95rem",
    transition: "border-color 160ms ease, box-shadow 160ms ease",
    boxShadow: hasError ? "0 0 0 3px rgba(248, 113, 113, 0.12)" : "none",
  };
}

function pillStyle(bg, border, color) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontSize: "0.8rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

const layoutGridStyle = {
  display: "grid",
  gap: 16,
  alignItems: "flex-start",
  gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)",
};

const mainCardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
};

const sideCardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const sideColumnStyle = {
  display: "grid",
  gap: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 18,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  color: "#0f172a",
};

const sectionTextStyle = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "0.92rem",
};

const sideTitleStyle = {
  margin: "0 0 10px",
  fontSize: "1rem",
  color: "#0f172a",
};

const securityHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 10,
};

const buttonRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 4,
};

const mutedParagraphStyle = {
  margin: "12px 0 0",
  fontSize: "0.88rem",
  color: "#6b7280",
  lineHeight: 1.5,
};

const loadingCardStyle = {
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
};

const fieldHelpStyle = {
  margin: "6px 0 0",
  fontSize: "0.8rem",
  color: "#94a3b8",
};

const fieldErrorStyle = {
  margin: "6px 0 0",
  fontSize: "0.8rem",
  color: "#b91c1c",
  fontWeight: 600,
};