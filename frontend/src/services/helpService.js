// frontend/src/services/helpService.js
import api from "../api/client";

function normalizeLanguage(language) {
  if (typeof language !== "string") return "es";
  return language.toLowerCase().startsWith("en") ? "en" : "es";
}

function normalizeHelpPayload(payload = {}) {
  return {
    subject: typeof payload.subject === "string" ? payload.subject.trim() : "",
    message: typeof payload.message === "string" ? payload.message.trim() : "",
    source:
      typeof payload.source === "string" && payload.source.trim()
        ? payload.source.trim()
        : "WEB_HELP_WIDGET",
  };
}

export async function getFaqs(language = "es", config = {}) {
  const lang = normalizeLanguage(language);

  const res = await api.get("/help/faqs", {
    ...config,
    params: {
      language: lang,
      ...(config.params || {}),
    },
  });

  return Array.isArray(res?.data?.data) ? res.data.data : [];
}

export async function createHelpQuery(payload = {}, config = {}) {
  const body = normalizeHelpPayload(payload);

  if (!body.subject) {
    throw new Error("Debes ingresar un asunto.");
  }

  if (!body.message) {
    throw new Error("Debes ingresar un mensaje.");
  }

  const res = await api.post("/help/query", body, config);
  return res?.data?.data || null;
}

export async function createHelpEscalation(payload = {}, config = {}) {
  const body = {
    ...normalizeHelpPayload(payload),
    priority:
      typeof payload.priority === "string" && payload.priority.trim()
        ? payload.priority.trim()
        : "high",
  };

  if (!body.subject) {
    throw new Error("Debes ingresar un asunto.");
  }

  if (!body.message) {
    throw new Error("Debes ingresar un mensaje.");
  }

  const res = await api.post("/help/escalations", body, config);
  return res?.data?.data || null;
}

const helpService = {
  getFaqs,
  createHelpQuery,
  createHelpEscalation,
};

export default helpService;