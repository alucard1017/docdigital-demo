// frontend/src/hooks/useUserPreferences.js
import { useCallback, useMemo, useState } from "react";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../services/userPreferencesService";
import { setAppLanguage, normalizeLanguage } from "../i18n";

const DEFAULT_PREFERENCES = Object.freeze({
  theme_mode: "system",
  language: "es",
  density: "comfortable",
});

const ALLOWED_THEME_MODES = new Set(["light", "dark", "system"]);
const ALLOWED_DENSITIES = new Set(["comfortable", "compact"]);

function normalizeThemeMode(value) {
  if (typeof value !== "string") return DEFAULT_PREFERENCES.theme_mode;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_THEME_MODES.has(normalized)
    ? normalized
    : DEFAULT_PREFERENCES.theme_mode;
}

function normalizeDensity(value) {
  if (typeof value !== "string") return DEFAULT_PREFERENCES.density;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_DENSITIES.has(normalized)
    ? normalized
    : DEFAULT_PREFERENCES.density;
}

function normalizePreferences(data = {}) {
  return {
    theme_mode: normalizeThemeMode(data.theme_mode),
    language: normalizeLanguage(data.language),
    density: normalizeDensity(data.density),
  };
}

function mergePreferences(base = DEFAULT_PREFERENCES, patch = {}) {
  return normalizePreferences({
    ...base,
    ...patch,
  });
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function applyThemeMode(themeMode) {
  if (typeof document === "undefined") return;

  const normalized = normalizeThemeMode(themeMode);
  document.documentElement.setAttribute("data-theme", normalized);
}

function applyDensity(density) {
  if (typeof document === "undefined") return;

  const normalized = normalizeDensity(density);
  document.documentElement.setAttribute("data-density", normalized);
}

async function applyPreferenceSideEffects(preferences) {
  const normalized = normalizePreferences(preferences);

  await setAppLanguage(normalized.language);
  applyThemeMode(normalized.theme_mode);
  applyDensity(normalized.density);

  return normalized;
}

export default function useUserPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const syncLocalPreferences = useCallback(async (nextPreferences = {}) => {
    const normalized = mergePreferences(preferences, nextPreferences);

    setPreferences(normalized);
    await applyPreferenceSideEffects(normalized);

    return normalized;
  }, [preferences]);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getUserPreferences();
      const normalized = normalizePreferences(data);

      setPreferences(normalized);
      await applyPreferenceSideEffects(normalized);

      return normalized;
    } catch (err) {
      const fallbackMessage = "No se pudieron cargar las preferencias.";
      const message = getErrorMessage(err, fallbackMessage);

      setError(message);
      setPreferences(DEFAULT_PREFERENCES);
      await applyPreferenceSideEffects(DEFAULT_PREFERENCES);

      return DEFAULT_PREFERENCES;
    } finally {
      setLoading(false);
    }
  }, []);

  const savePreferences = useCallback(async (nextPreferences = {}) => {
    const previousPreferences = preferences;

    try {
      setSaving(true);
      setError("");

      const payload = mergePreferences(preferences, nextPreferences);

      const data = await updateUserPreferences(payload);
      const normalized = normalizePreferences(data);

      setPreferences(normalized);
      await applyPreferenceSideEffects(normalized);

      return normalized;
    } catch (err) {
      const fallbackMessage = "No se pudieron guardar las preferencias.";
      const message = getErrorMessage(err, fallbackMessage);

      setError(message);
      setPreferences(previousPreferences);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  const resetPreferences = useCallback(async () => {
    setPreferences(DEFAULT_PREFERENCES);
    setError("");
    await applyPreferenceSideEffects(DEFAULT_PREFERENCES);
    return DEFAULT_PREFERENCES;
  }, []);

  const hasDefaults = useMemo(() => {
    return (
      preferences.theme_mode === DEFAULT_PREFERENCES.theme_mode &&
      preferences.language === DEFAULT_PREFERENCES.language &&
      preferences.density === DEFAULT_PREFERENCES.density
    );
  }, [preferences]);

  const isDirty = useMemo(() => !hasDefaults, [hasDefaults]);

  return {
    preferences,
    setPreferences,
    loading,
    saving,
    error,
    hasDefaults,
    isDirty,
    loadPreferences,
    savePreferences,
    resetPreferences,
    syncLocalPreferences,
    clearError,
    defaultPreferences: DEFAULT_PREFERENCES,
  };
}