import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import esTranslation from "./locales/es/translation.json";
import enTranslation from "./locales/en/translation.json";

export const SUPPORTED_LANGUAGES = ["es", "en"];
export const FALLBACK_LANGUAGE = "es";
export const LANGUAGE_STORAGE_KEY = "app-language";

const DEFAULT_NAMESPACE = "translation";

const resources = {
  es: { [DEFAULT_NAMESPACE]: esTranslation },
  en: { [DEFAULT_NAMESPACE]: enTranslation },
};

let pendingLanguageChange = null;
let pendingLanguageTarget = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function hasLocalStorage() {
  if (!isBrowser()) return false;

  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function normalizeLanguage(input) {
  if (typeof input !== "string") {
    return FALLBACK_LANGUAGE;
  }

  const normalized = input.trim().toLowerCase().split("-")[0];

  return SUPPORTED_LANGUAGES.includes(normalized)
    ? normalized
    : FALLBACK_LANGUAGE;
}

export function isSupportedLanguage(input) {
  if (typeof input !== "string") return false;
  return SUPPORTED_LANGUAGES.includes(input.trim().toLowerCase().split("-")[0]);
}

function getStoredLanguage() {
  if (!hasLocalStorage()) return null;

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored ? normalizeLanguage(stored) : null;
  } catch (error) {
    console.warn("No se pudo leer el idioma guardado:", error);
    return null;
  }
}

function getBrowserLanguage() {
  if (typeof navigator === "undefined") return null;

  try {
    const candidates = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;

      const normalized = normalizeLanguage(candidate);
      if (isSupportedLanguage(normalized)) {
        return normalized;
      }
    }

    return null;
  } catch (error) {
    console.warn("No se pudo detectar el idioma del navegador:", error);
    return null;
  }
}

export function getInitialLanguage() {
  return getStoredLanguage() || getBrowserLanguage() || FALLBACK_LANGUAGE;
}

export function getCurrentLanguage() {
  return normalizeLanguage(i18n.resolvedLanguage || i18n.language);
}

function syncHtmlLanguage(language) {
  if (typeof document === "undefined") return;

  const normalized = normalizeLanguage(language);
  document.documentElement.lang = normalized;
}

function persistLanguage(language) {
  if (!hasLocalStorage()) return;

  try {
    const normalized = normalizeLanguage(language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch (error) {
    console.warn("No se pudo guardar el idioma:", error);
  }
}

function applyLanguageSideEffects(language) {
  const normalized = normalizeLanguage(language);
  syncHtmlLanguage(normalized);
  persistLanguage(normalized);
  return normalized;
}

export async function setAppLanguage(nextLanguage) {
  const normalized = normalizeLanguage(nextLanguage);
  const current = getCurrentLanguage();

  if (current === normalized) {
    return applyLanguageSideEffects(normalized);
  }

  if (pendingLanguageChange && pendingLanguageTarget === normalized) {
    return pendingLanguageChange;
  }

  pendingLanguageTarget = normalized;

  pendingLanguageChange = i18n
    .changeLanguage(normalized)
    .then(() => applyLanguageSideEffects(normalized))
    .catch((error) => {
      console.error("No se pudo cambiar el idioma:", error);
      throw error;
    })
    .finally(() => {
      pendingLanguageChange = null;
      pendingLanguageTarget = null;
    });

  return pendingLanguageChange;
}

const initialLanguage = getInitialLanguage();

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: [DEFAULT_NAMESPACE],
    defaultNS: DEFAULT_NAMESPACE,
    load: "languageOnly",
    cleanCode: true,
    nonExplicitSupportedLngs: true,
    returnEmptyString: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    debug: Boolean(import.meta.env?.DEV),
  });
}

applyLanguageSideEffects(initialLanguage);

export default i18n;