const RUN_MAX_LENGTH = 10;

function sanitizeRun(value = "") {
  return String(value).replace(/[^0-9kK]/g, "");
}

function splitRunParts(value = "") {
  const clean = sanitizeRun(value).slice(0, RUN_MAX_LENGTH);

  if (!clean) {
    return {
      clean: "",
      body: "",
      dv: "",
    };
  }

  if (clean.length === 1) {
    return {
      clean,
      body: "",
      dv: clean,
    };
  }

  return {
    clean,
    body: clean.slice(0, -1),
    dv: clean.slice(-1),
  };
}

function addThousandsSeparator(value = "") {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function normalizeRun(run = "") {
  return String(run).replace(/[.\-]/g, "");
}

export function formatRun(value = "") {
  const { clean, body, dv } = splitRunParts(value);

  if (!clean) return "";
  if (!body) return dv;

  return `${addThousandsSeparator(body)}-${dv}`;
}

export function formatRunDoc(value = "") {
  const { clean, body, dv } = splitRunParts(value);

  if (!clean) return "";
  if (!body) return dv;

  return `${addThousandsSeparator(body)}-${dv}`;
}

export function getRoleLabel(role = "") {
  const labels = {
    SUPER_ADMIN: "Super admin",
    ADMIN_GLOBAL: "Admin global",
    ADMIN: "Admin",
    USER: "Usuario",
  };

  return labels[role] || "Usuario";
}

export function isAdminLikeRole(role = "") {
  return ["ADMIN", "ADMIN_GLOBAL", "SUPER_ADMIN"].includes(role);
}