// src/context/PreferencesContext.jsx
import { createContext, useContext, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import useUserPreferences from "../hooks/useUserPreferences";
import { FALLBACK_LANGUAGE, normalizeLanguage } from "../i18n";

const PreferencesContext = createContext(null);

const DEFAULT_PREFERENCES = Object.freeze({
  themeMode: "system",
  language: FALLBACK_LANGUAGE,
  density: "comfortable",
});

function normalizeContextPreferences(preferences = {}) {
  return {
    themeMode:
      typeof preferences.theme_mode === "string" && preferences.theme_mode.trim()
        ? preferences.theme_mode.trim().toLowerCase()
        : typeof preferences.themeMode === "string" && preferences.themeMode.trim()
        ? preferences.themeMode.trim().toLowerCase()
        : DEFAULT_PREFERENCES.themeMode,

    language: normalizeLanguage(
      preferences.language ?? DEFAULT_PREFERENCES.language
    ),

    density:
      typeof preferences.density === "string" && preferences.density.trim()
        ? preferences.density.trim().toLowerCase()
        : DEFAULT_PREFERENCES.density,
  };
}

function toServicePayload(preferences = {}) {
  const normalized = normalizeContextPreferences(preferences);

  return {
    theme_mode: normalized.themeMode,
    language: normalized.language,
    density: normalized.density,
  };
}

export function PreferencesProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  const {
    preferences,
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
    defaultPreferences,
  } = useUserPreferences();

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      loadPreferences();
      return;
    }

    resetPreferences();
  }, [authLoading, isAuthenticated, loadPreferences, resetPreferences]);

  const normalizedPreferences = useMemo(
    () => normalizeContextPreferences(preferences),
    [preferences]
  );

  const normalizedDefaults = useMemo(
    () => normalizeContextPreferences(defaultPreferences),
    [defaultPreferences]
  );

  const setThemeMode = async (themeMode) => {
    return syncLocalPreferences({
      ...toServicePayload(normalizedPreferences),
      theme_mode: themeMode,
    });
  };

  const setLanguage = async (language) => {
    return syncLocalPreferences({
      ...toServicePayload(normalizedPreferences),
      language,
    });
  };

  const changeLanguage = setLanguage;

  const setDensity = async (density) => {
    return syncLocalPreferences({
      ...toServicePayload(normalizedPreferences),
      density,
    });
  };

  const toggleTheme = async () => {
    const current = normalizedPreferences.themeMode;

    if (current === "dark") {
      return setThemeMode("light");
    }

    if (current === "light") {
      return setThemeMode("dark");
    }

    return setThemeMode("dark");
  };

  const hydratePreferences = async (prefs = {}) => {
    const normalized = normalizeContextPreferences(prefs);
    await syncLocalPreferences(toServicePayload(normalized));
    return normalized;
  };

  const saveAllPreferences = async (prefs = {}) => {
    const normalized = normalizeContextPreferences({
      ...normalizedPreferences,
      ...prefs,
    });

    const saved = await savePreferences(toServicePayload(normalized));
    return normalizeContextPreferences(saved);
  };

  const resetAllPreferences = async () => {
    await resetPreferences();
    return normalizedDefaults;
  };

  const value = useMemo(
    () => ({
      preferences: normalizedPreferences,
      themeMode: normalizedPreferences.themeMode,
      language: normalizedPreferences.language,
      density: normalizedPreferences.density,

      loading,
      saving,
      error,
      hasDefaults,
      isDirty,

      loadPreferences,
      savePreferences: saveAllPreferences,
      resetPreferences: resetAllPreferences,
      hydratePreferences,
      syncLocalPreferences,
      clearError,

      setThemeMode,
      toggleTheme,
      setLanguage,
      changeLanguage,
      setDensity,

      defaultPreferences: normalizedDefaults,
    }),
    [
      normalizedPreferences,
      loading,
      saving,
      error,
      hasDefaults,
      isDirty,
      loadPreferences,
      syncLocalPreferences,
      clearError,
      normalizedDefaults,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "usePreferences debe usarse dentro de <PreferencesProvider>"
    );
  }

  return context;
}