// frontend/src/utils/router.js
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
  if (typeof window === "undefined") return "/";
  return normalizePath(window.location.pathname);
}

export function isCurrentPath(path) {
  return getPath() === normalizePath(path);
}

export function pathsMatch(a, b) {
  return normalizePath(a) === normalizePath(b);
}

function notifyNavigation(detail = {}) {
  if (typeof window === "undefined") return;

  const eventDetail = {
    path: getPath(),
    previousPath: detail.previousPath
      ? normalizePath(detail.previousPath)
      : null,
    state: detail.state ?? null,
    replace: !!detail.replace,
    source: detail.source || "app",
  };

  window.dispatchEvent(
    new CustomEvent(APP_NAVIGATION_EVENT, {
      detail: eventDetail,
    })
  );

  window.dispatchEvent(
    new PopStateEvent("popstate", { state: eventDetail.state })
  );
}

export function navigateTo(path, options = {}) {
  if (typeof window === "undefined") return;

  const nextPath = normalizePath(path);
  const currentPath = getPath();

  if (nextPath === currentPath && !options.force) return;

  window.history.pushState(options.state ?? {}, "", nextPath);

  notifyNavigation({
    previousPath: currentPath,
    state: options.state ?? null,
    replace: false,
    source: options.source || "navigateTo",
  });
}

export function replaceTo(path, options = {}) {
  if (typeof window === "undefined") return;

  const nextPath = normalizePath(path);
  const currentPath = getPath();

  if (nextPath === currentPath && !options.force) return;

  window.history.replaceState(options.state ?? {}, "", nextPath);

  notifyNavigation({
    previousPath: currentPath,
    state: options.state ?? null,
    replace: true,
    source: options.source || "replaceTo",
  });
}

export function getNavigationEventName() {
  return APP_NAVIGATION_EVENT;
}

export function subscribeToNavigation(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") {
    return () => {};
  }

  const handler = (event) => {
    listener(event);
  };

  window.addEventListener(APP_NAVIGATION_EVENT, handler);
  window.addEventListener("popstate", handler);

  return () => {
    window.removeEventListener(APP_NAVIGATION_EVENT, handler);
    window.removeEventListener("popstate", handler);
  };
}