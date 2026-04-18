const { axios } = require("./common");

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "yes", "si", "sí"].includes(v);
  }
  if (typeof value === "number") return value === 1;
  return defaultValue;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toJson(value, fallback = null) {
  try {
    return value == null ? fallback : JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripInvisibleChars(value) {
  return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeText(value) {
  return stripInvisibleChars(value)
    .replace(/\s+/g, " ")
    .trim();
}

function getSafeBaseFileName(filename) {
  return normalizeText(String(filename || "").replace(/\.pdf$/i, ""));
}

function sanitizeFileName(value, fallback = "documento") {
  const normalized = normalizeText(value)
    .replace(/[<>:"/\\|\?\*\x00-\x1F]/g, "-")
    .replace(/\.+$/g, "")
    .replace(/^\.+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  return normalized || fallback;
}

function buildSafeStorageFileName(originalname, code) {
  const safeBaseName = sanitizeFileName(
    getSafeBaseFileName(originalname || "documento"),
    "documento"
  );
  return `${Date.now()}-${code}-${safeBaseName}.pdf`;
}

async function fetchPdfBufferFromUrl(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    throw new Error("URL vacía en fetchPdfBufferFromUrl");
  }

  const response = await axios.get(safeUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024,
    headers: {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const contentType = String(
    response.headers?.["content-type"] || ""
  ).toLowerCase();

  if (
    contentType &&
    !contentType.includes("application/pdf") &&
    !contentType.includes("application/octet-stream")
  ) {
    console.warn(
      `⚠️ fetchPdfBufferFromUrl content-type inesperado: ${contentType}`
    );
  }

  const buffer = Buffer.from(response.data);
  if (!buffer.length) {
    throw new Error("El archivo remoto llegó vacío");
  }

  return buffer;
}

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function normalizeStatus(value) {
  if (!value) return null;
  return String(value).trim().toUpperCase();
}

module.exports = {
  normalizeBoolean,
  normalizeArray,
  toJson,
  safeLower,
  uniqueBy,
  stripInvisibleChars,
  normalizeText,
  getSafeBaseFileName,
  sanitizeFileName,
  buildSafeStorageFileName,
  fetchPdfBufferFromUrl,
  isGlobalAdmin,
  normalizeStatus,
};