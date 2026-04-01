const APP_NAVIGATION_EVENT = "app:navigation";

export function normalizePath(path) {
  if (!path || typeof path !== "string") return "/";

  let normalized = path.trim();

  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}

export function getPath() {
  return normalizePath(window.location.pathname);
}

export function isCurrentPath(path) {
  return getPath() === normalizePath(path);
}

function notifyNavigation() {
  window.dispatchEvent(new Event(APP_NAVIGATION_EVENT));
}

export function navigateTo(path, options = {}) {
  const nextPath = normalizePath(path);
  const currentPath = getPath();

  if (nextPath === currentPath && !options.force) return;

  window.history.pushState(options.state ?? {}, "", nextPath);
  notifyNavigation();
}

export function replaceTo(path, options = {}) {
  const nextPath = normalizePath(path);
  const currentPath = getPath();

  if (nextPath === currentPath && !options.force) return;

  window.history.replaceState(options.state ?? {}, "", nextPath);
  notifyNavigation();
}

export function getNavigationEventName() {
  return APP_NAVIGATION_EVENT;
}