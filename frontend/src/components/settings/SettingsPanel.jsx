// src/components/settings/SettingsPanel.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Moon,
  Sun,
  MonitorCog,
  Languages,
  Maximize2,
  Minimize2,
  X,
  Save,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../../services/userPreferencesService";
import "../../styles/settingsPanel.css";

const THEME_OPTIONS = [
  { value: "system", label: "Usar sistema", icon: MonitorCog },
  { value: "light", label: "Modo claro", icon: Sun },
  { value: "dark", label: "Modo oscuro", icon: Moon },
];

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Cómoda", icon: Maximize2 },
  { value: "compact", label: "Compacta", icon: Minimize2 },
];

function resolveSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
}

function applyTheme(themeMode) {
  const root = document.documentElement;
  const effectiveTheme =
    themeMode === "system" ? resolveSystemTheme() : themeMode;

  root.setAttribute("data-theme", effectiveTheme);
}

function applyDensity(density) {
  document.documentElement.setAttribute(
    "data-density",
    density || "comfortable"
  );
}

export default function SettingsPanel({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const { addToast } = useToast();

  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [themeMode, setThemeMode] = useState("system");
  const [language, setLanguage] = useState("es");
  const [density, setDensity] = useState("comfortable");

  const [initialPrefs, setInitialPrefs] = useState({
    themeMode: "system",
    language: "es",
    density: "comfortable",
  });

  const hasChanges = useMemo(() => {
    return (
      themeMode !== initialPrefs.themeMode ||
      language !== initialPrefs.language ||
      density !== initialPrefs.density
    );
  }, [themeMode, language, density, initialPrefs]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadPreferences() {
      try {
        setLoadingPrefs(true);

        const data = await getUserPreferences();
        if (cancelled) return;

        const nextThemeMode = data?.theme_mode || "system";
        const nextLanguage = data?.language || "es";
        const nextDensity = data?.density || "comfortable";

        setThemeMode(nextThemeMode);
        setLanguage(nextLanguage);
        setDensity(nextDensity);

        setInitialPrefs({
          themeMode: nextThemeMode,
          language: nextLanguage,
          density: nextDensity,
        });

        applyTheme(nextThemeMode);
        applyDensity(nextDensity);
        i18n.changeLanguage(nextLanguage).catch(() => {});
      } catch (error) {
        if (cancelled) return;

        addToast({
          type: "error",
          title: "No se pudieron cargar los ajustes",
          message:
            error?.response?.data?.message ||
            error?.message ||
            "Intenta nuevamente en unos segundos.",
        });
      } finally {
        if (!cancelled) {
          setLoadingPrefs(false);
        }
      }
    }

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [isOpen, addToast, i18n]);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  useEffect(() => {
    i18n.changeLanguage(language).catch(() => {});
  }, [language, i18n]);

  useEffect(() => {
    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      applyTheme("system");
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    if (typeof media.addListener === "function") {
      media.addListener(handleChange);
      return () => media.removeListener(handleChange);
    }
  }, [themeMode]);

  const handleSave = async () => {
    try {
      setSavingPrefs(true);

      const saved = await updateUserPreferences({
        theme_mode: themeMode,
        language,
        density,
      });

      const nextThemeMode = saved?.theme_mode || "system";
      const nextLanguage = saved?.language || "es";
      const nextDensity = saved?.density || "comfortable";

      setThemeMode(nextThemeMode);
      setLanguage(nextLanguage);
      setDensity(nextDensity);

      setInitialPrefs({
        themeMode: nextThemeMode,
        language: nextLanguage,
        density: nextDensity,
      });

      applyTheme(nextThemeMode);
      applyDensity(nextDensity);
      i18n.changeLanguage(nextLanguage).catch(() => {});

      addToast({
        type: "success",
        title: "Preferencias guardadas",
        message: "Tus ajustes se guardaron correctamente.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "No se pudieron guardar los ajustes",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="settings-backdrop" onClick={handleClose} />

      <aside
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
      >
        <div className="settings-panel__header">
          <div>
            <h2 id="settings-panel-title" className="settings-panel__title">
              Ajustes
            </h2>
            <p className="settings-panel__subtitle">
              Personaliza el idioma, la apariencia y la densidad de la interfaz.
            </p>
          </div>

          <button
            type="button"
            className="settings-panel__close"
            onClick={handleClose}
            aria-label="Cerrar ajustes"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-panel__body">
          {loadingPrefs ? (
            <div className="settings-panel__loading">
              Cargando preferencias…
            </div>
          ) : (
            <>
              <section className="settings-section">
                <div className="settings-section__heading">
                  <h3>Apariencia</h3>
                  <p>Elige cómo se verá la aplicación en tu sesión.</p>
                </div>

                <div className="settings-options-grid">
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = themeMode === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`settings-option-card ${
                          active ? "is-active" : ""
                        }`}
                        onClick={() => setThemeMode(option.value)}
                      >
                        <span className="settings-option-card__icon">
                          <Icon size={18} />
                        </span>
                        <span className="settings-option-card__text">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section__heading">
                  <h3>Idioma</h3>
                  <p>Selecciona el idioma principal de la interfaz.</p>
                </div>

                <label className="settings-field">
                  <span className="settings-field__label">
                    <Languages size={16} />
                    <span>Idioma de la aplicación</span>
                  </span>

                  <select
                    className="settings-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </section>

              <section className="settings-section">
                <div className="settings-section__heading">
                  <h3>Densidad</h3>
                  <p>
                    Reduce o amplía espacios en listas, tablas y controles.
                  </p>
                </div>

                <div className="settings-options-grid">
                  {DENSITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = density === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`settings-option-card ${
                          active ? "is-active" : ""
                        }`}
                        onClick={() => setDensity(option.value)}
                      >
                        <span className="settings-option-card__icon">
                          <Icon size={18} />
                        </span>
                        <span className="settings-option-card__text">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="settings-panel__footer">
          <button
            type="button"
            className="btn-main btn-ghost"
            onClick={handleClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn-main btn-primary"
            onClick={handleSave}
            disabled={savingPrefs || loadingPrefs || !hasChanges}
          >
            <Save size={16} />
            <span>{savingPrefs ? "Guardando..." : "Guardar cambios"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}