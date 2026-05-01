import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { usePreferences } from "../../context/PreferencesContext";
import { FALLBACK_LANGUAGE, normalizeLanguage } from "../../i18n";
import "../../styles/settingsPanel.css";

const VALID_THEME_MODES = ["system", "light", "dark"];
const VALID_DENSITIES = ["comfortable", "compact"];
const VALID_LANGUAGES = ["es", "en"];

const DEFAULT_PREFS = {
  themeMode: "system",
  language: FALLBACK_LANGUAGE,
  density: "comfortable",
};

function normalizePreferences(data = {}, fallbackLanguage = FALLBACK_LANGUAGE) {
  const safeFallbackLanguage = normalizeLanguage(fallbackLanguage);

  const themeMode =
    typeof data.themeMode === "string" &&
    VALID_THEME_MODES.includes(data.themeMode)
      ? data.themeMode
      : typeof data.theme_mode === "string" &&
        VALID_THEME_MODES.includes(data.theme_mode)
      ? data.theme_mode
      : DEFAULT_PREFS.themeMode;

  const language = normalizeLanguage(data.language);

  const density =
    typeof data.density === "string" &&
    VALID_DENSITIES.includes(data.density)
      ? data.density
      : DEFAULT_PREFS.density;

  return {
    themeMode,
    language: VALID_LANGUAGES.includes(language)
      ? language
      : VALID_LANGUAGES.includes(safeFallbackLanguage)
      ? safeFallbackLanguage
      : DEFAULT_PREFS.language,
    density,
  };
}

export default function SettingsPanel({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();

  const {
    preferences,
    loading,
    saving,
    error,
    loadPreferences,
    savePreferences,
  } = usePreferences();

  const closeButtonRef = useRef(null);
  const panelRef = useRef(null);
  const previousFocusedElementRef = useRef(null);
  const previousBodyOverflowRef = useRef("");
  const previousHtmlOverflowRef = useRef("");

  const resolvedLanguage =
    i18n?.resolvedLanguage ||
    i18n?.language ||
    preferences?.language ||
    FALLBACK_LANGUAGE;

  const syncedPrefs = useMemo(() => {
    return normalizePreferences(
      {
        themeMode: preferences?.themeMode,
        language: preferences?.language,
        density: preferences?.density,
      },
      resolvedLanguage
    );
  }, [preferences, resolvedLanguage]);

  const [draft, setDraft] = useState(syncedPrefs);
  const [initialPrefs, setInitialPrefs] = useState(syncedPrefs);

  const loadingPrefs = loading && isOpen;
  const savingPrefs = saving;

  const hasChanges = useMemo(() => {
    return (
      draft.themeMode !== initialPrefs.themeMode ||
      draft.language !== initialPrefs.language ||
      draft.density !== initialPrefs.density
    );
  }, [draft, initialPrefs]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    if (typeof document !== "undefined") {
      previousBodyOverflowRef.current = document.body.style.overflow;
      previousHtmlOverflowRef.current = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus?.();
      panelRef.current?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(timer);

      if (typeof document !== "undefined") {
        document.body.style.overflow = previousBodyOverflowRef.current || "";
        document.documentElement.style.overflow =
          previousHtmlOverflowRef.current || "";
      }

      previousFocusedElementRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setDraft(syncedPrefs);
    setInitialPrefs(syncedPrefs);
  }, [isOpen, syncedPrefs]);

  useEffect(() => {
    if (!isOpen) return;

    loadPreferences().catch(() => {});
  }, [isOpen, loadPreferences]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !savingPrefs) {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, savingPrefs]);

  const updateDraft = useCallback(
    (patch) => {
      setDraft((current) =>
        normalizePreferences(
          { ...current, ...patch },
          current.language || resolvedLanguage
        )
      );
    },
    [resolvedLanguage]
  );

  const handleClose = useCallback(() => {
    if (savingPrefs) return;
    setDraft(initialPrefs);
    onClose?.();
  }, [initialPrefs, onClose, savingPrefs]);

  const handleSave = useCallback(async () => {
    if (savingPrefs || !hasChanges) return;

    try {
      const payload = {
        themeMode: draft.themeMode,
        language: normalizeLanguage(draft.language),
        density: draft.density,
      };

      const saved = await savePreferences(payload);
      const next = normalizePreferences(saved, payload.language);

      setDraft(next);
      setInitialPrefs(next);

      addToast({
        type: "success",
        title: t("settings.toasts.saveSuccessTitle", "Preferencias guardadas"),
        message: t(
          "settings.toasts.saveSuccessMessage",
          "Tus ajustes se guardaron correctamente."
        ),
      });

      onClose?.();
    } catch (saveError) {
      addToast({
        type: "error",
        title: t(
          "settings.toasts.saveErrorTitle",
          "No se pudieron guardar los ajustes"
        ),
        message:
          saveError?.response?.data?.message ||
          saveError?.message ||
          t(
            "settings.toasts.saveErrorMessage",
            "Intenta nuevamente en unos segundos."
          ),
      });
    }
  }, [
    addToast,
    draft,
    hasChanges,
    onClose,
    savePreferences,
    savingPrefs,
    t,
  ]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await handleSave();
    },
    [handleSave]
  );

  const themeOptions = useMemo(
    () => [
      {
        value: "system",
        label: t("settings.theme.options.system", "Seguir sistema"),
        description: t(
          "settings.theme.options.systemHint",
          "Usa el modo claro u oscuro de tu dispositivo."
        ),
        icon: MonitorCog,
      },
      {
        value: "light",
        label: t("settings.theme.options.light", "Modo claro"),
        description: t(
          "settings.theme.options.lightHint",
          "Mantiene siempre la interfaz en modo claro."
        ),
        icon: Sun,
      },
      {
        value: "dark",
        label: t("settings.theme.options.dark", "Modo oscuro"),
        description: t(
          "settings.theme.options.darkHint",
          "Mantiene siempre la interfaz en modo oscuro."
        ),
        icon: Moon,
      },
    ],
    [t]
  );

  const densityOptions = useMemo(
    () => [
      {
        value: "comfortable",
        label: t("settings.density.options.comfortable", "Cómoda"),
        description: t(
          "settings.density.options.comfortableHint",
          "Más espacio visual entre filas y controles."
        ),
        icon: Maximize2,
      },
      {
        value: "compact",
        label: t("settings.density.options.compact", "Compacta"),
        description: t(
          "settings.density.options.compactHint",
          "Reduce espacios para mostrar más contenido."
        ),
        icon: Minimize2,
      },
    ],
    [t]
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="settings-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="settings-panel settings-panel--fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
        aria-describedby="settings-panel-description"
        aria-busy={loadingPrefs || savingPrefs}
        aria-hidden={!isOpen}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <form className="settings-panel__form" onSubmit={handleSubmit}>
          <div className="settings-panel__header">
            <div>
              <h2 id="settings-panel-title" className="settings-panel__title">
                {t("settings.title", "Ajustes")}
              </h2>
              <p
                id="settings-panel-description"
                className="settings-panel__subtitle"
              >
                {t(
                  "settings.subtitle",
                  "Personaliza idioma, apariencia y densidad de la interfaz."
                )}
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              className="settings-panel__close"
              onClick={handleClose}
              aria-label={t("settings.close", "Cerrar ajustes")}
              disabled={savingPrefs}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="settings-panel__body">
            {error ? (
              <div className="settings-panel__loading" role="status">
                {error}
              </div>
            ) : null}

            <section className="settings-section">
              <div className="settings-section__heading">
                <h3>{t("settings.theme.title", "Apariencia")}</h3>
                <p>
                  {t(
                    "settings.theme.description",
                    "Elige cómo se verá la aplicación."
                  )}
                </p>
              </div>

              <div className="settings-options-grid">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = draft.themeMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`settings-option-card ${active ? "is-active" : ""}`}
                      onClick={() => updateDraft({ themeMode: option.value })}
                      aria-pressed={active}
                      disabled={savingPrefs}
                      title={option.description}
                    >
                      <span
                        className="settings-option-card__icon"
                        aria-hidden="true"
                      >
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
                <h3>{t("settings.language.title", "Idioma")}</h3>
                <p>
                  {t(
                    "settings.language.description",
                    "Selecciona el idioma principal de la interfaz."
                  )}
                </p>
              </div>

              <label className="settings-field">
                <span className="settings-field__label">
                  <Languages size={16} aria-hidden="true" />
                  <span>
                    {t(
                      "settings.language.fieldLabel",
                      "Idioma de la aplicación"
                    )}
                  </span>
                </span>

                <select
                  className="settings-select"
                  value={draft.language}
                  onChange={(event) =>
                    updateDraft({ language: event.target.value })
                  }
                  disabled={savingPrefs}
                >
                  <option value="es">
                    {t("settings.language.options.es", "Español")}
                  </option>
                  <option value="en">
                    {t("settings.language.options.en", "English")}
                  </option>
                </select>
              </label>
            </section>

            <section className="settings-section">
              <div className="settings-section__heading">
                <h3>{t("settings.density.title", "Densidad")}</h3>
                <p>
                  {t(
                    "settings.density.description",
                    "Reduce o amplía espacios en tablas, listas y controles."
                  )}
                </p>
              </div>

              <div className="settings-options-grid settings-options-grid--two">
                {densityOptions.map((option) => {
                  const Icon = option.icon;
                  const active = draft.density === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`settings-option-card ${active ? "is-active" : ""}`}
                      onClick={() => updateDraft({ density: option.value })}
                      aria-pressed={active}
                      disabled={savingPrefs}
                      title={option.description}
                    >
                      <span
                        className="settings-option-card__icon"
                        aria-hidden="true"
                      >
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

            {loadingPrefs ? (
              <div className="settings-panel__loading" role="status">
                {t("settings.loading", "Cargando preferencias…")}
              </div>
            ) : null}
          </div>

          <div className="settings-panel__footer">
            <button
              type="button"
              className="btn-main btn-ghost"
              onClick={handleClose}
              disabled={savingPrefs}
            >
              {t("settings.actions.cancel", "Cancelar")}
            </button>

            <button
              type="submit"
              className="btn-main btn-primary"
              disabled={savingPrefs || loadingPrefs || !hasChanges}
            >
              <Save size={16} aria-hidden="true" />
              <span>
                {savingPrefs
                  ? t("settings.actions.saving", "Guardando...")
                  : t("settings.actions.save", "Guardar cambios")}
              </span>
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}