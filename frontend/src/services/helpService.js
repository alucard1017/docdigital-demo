// frontend/src/services/helpService.js
import api from "../api/client";

const DEFAULT_LANGUAGE = "es";
const DEFAULT_SOURCE = "WEB_HELP_WIDGET";
const DEFAULT_PRIORITY = "high";
const ALLOWED_LANGUAGES = new Set(["es", "en"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function normalizeLanguage(language) {
  if (typeof language !== "string") return DEFAULT_LANGUAGE;

  const normalized = language.trim().toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";

  return DEFAULT_LANGUAGE;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSource(source) {
  const normalized = normalizeText(source);
  return normalized || DEFAULT_SOURCE;
}

function normalizePriority(priority) {
  const normalized = normalizeText(priority).toLowerCase();
  return ALLOWED_PRIORITIES.has(normalized)
    ? normalized
    : DEFAULT_PRIORITY;
}

function normalizeHelpPayload(payload = {}) {
  return {
    subject: normalizeText(payload.subject),
    message: normalizeText(payload.message),
    source: normalizeSource(payload.source),
  };
}

function validateHelpPayload(payload) {
  if (!payload.subject) {
    throw new Error("Debes ingresar un asunto.");
  }

  if (!payload.message) {
    throw new Error("Debes ingresar un mensaje.");
  }
}

function buildFaqParams(language, extraParams = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  return {
    ...extraParams,
    language: ALLOWED_LANGUAGES.has(normalizedLanguage)
      ? normalizedLanguage
      : DEFAULT_LANGUAGE,
  };
}

function getResponseData(response) {
  return response?.data?.data ?? null;
}

function normalizeFaqList(data) {
  return Array.isArray(data) ? data : [];
}

function getServiceErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

export async function getFaqs(language = DEFAULT_LANGUAGE, config = {}) {
  try {
    const response = await api.get("/help/faqs", {
      ...config,
      params: buildFaqParams(language, config.params || {}),
    });

    return normalizeFaqList(getResponseData(response));
  } catch (error) {
    throw new Error(
      getServiceErrorMessage(
        error,
        "No se pudieron cargar las preguntas frecuentes."
      )
    );
  }
}

export async function createHelpQuery(payload = {}, config = {}) {
  const body = normalizeHelpPayload(payload);
  validateHelpPayload(body);

  try {
    const response = await api.post("/help/query", body, config);
    return getResponseData(response);
  } catch (error) {
    throw new Error(
      getServiceErrorMessage(
        error,
        "No se pudo enviar la solicitud de ayuda."
      )
    );
  }
}

export async function createHelpEscalation(payload = {}, config = {}) {
  const basePayload = normalizeHelpPayload(payload);

  const body = {
    ...basePayload,
    priority: normalizePriority(payload.priority),
  };

  validateHelpPayload(body);

  try {
    const response = await api.post("/help/escalations", body, config);
    return getResponseData(response);
  } catch (error) {
    throw new Error(
      getServiceErrorMessage(
        error,
        "No se pudo escalar la solicitud de ayuda."
      )
    );
  }
}

const helpService = {
  getFaqs,
  createHelpQuery,
  createHelpEscalation,
};

export default helpService;