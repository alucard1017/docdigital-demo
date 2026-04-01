// frontend/src/utils/session.js

export const ACCESS_TOKEN_KEY = "accessToken";
export const USER_KEY = "user";
export const SESSION_MODE_KEY = "sessionMode";

export const SESSION_MODE_PERSISTENT = "persistent";
export const SESSION_MODE_TEMPORARY = "temporary";

function isStorageAvailable(storage) {
  try {
    if (!storage) return false;

    const testKey = "__storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getSafeStorage(type) {
  if (typeof window === "undefined") return null;

  const storage =
    type === "local" ? window.localStorage : window.sessionStorage;

  return isStorageAvailable(storage) ? storage : null;
}

function safeGet(storage, key) {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getLocalStorageSafe() {
  return getSafeStorage("local");
}

function getSessionStorageSafe() {
  return getSafeStorage("session");
}

function normalizeToken(token) {
  return typeof token === "string" ? token.trim() : "";
}

function normalizeUser(user) {
  return user && typeof user === "object" && !Array.isArray(user) ? user : null;
}

function parseUser(raw) {
  if (!raw || typeof raw !== "string") return null;

  try {
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearKeys(storage, keys = []) {
  if (!storage) return;

  keys.forEach((key) => {
    safeRemove(storage, key);
  });
}

function readSessionFromStorage(storage) {
  if (!storage) {
    return {
      token: "",
      user: null,
      mode: null,
      valid: false,
    };
  }

  const token = normalizeToken(safeGet(storage, ACCESS_TOKEN_KEY));
  const user = parseUser(safeGet(storage, USER_KEY));
  const mode = safeGet(storage, SESSION_MODE_KEY);

  const valid = !!token && !!user;

  return {
    token,
    user,
    mode,
    valid,
  };
}

function cleanupBrokenSession(storage) {
  if (!storage) return;

  const token = normalizeToken(safeGet(storage, ACCESS_TOKEN_KEY));
  const user = parseUser(safeGet(storage, USER_KEY));

  if ((token && !user) || (!token && user)) {
    clearKeys(storage, [ACCESS_TOKEN_KEY, USER_KEY]);
  }
}

function getResolvedSession() {
  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  cleanupBrokenSession(localStorageSafe);
  cleanupBrokenSession(sessionStorageSafe);

  const localSession = readSessionFromStorage(localStorageSafe);
  const sessionSession = readSessionFromStorage(sessionStorageSafe);

  if (localSession.valid) {
    return {
      user: localSession.user,
      token: localSession.token,
      mode: SESSION_MODE_PERSISTENT,
    };
  }

  if (sessionSession.valid) {
    return {
      user: sessionSession.user,
      token: sessionSession.token,
      mode: SESSION_MODE_TEMPORARY,
    };
  }

  return {
    user: null,
    token: "",
    mode: null,
  };
}

export function getStoredToken() {
  return getResolvedSession().token;
}

export function getStoredUser() {
  return getResolvedSession().user;
}

export function setSession(user, token, options = {}) {
  const { rememberMe = false } = options;

  const normalizedUser = normalizeUser(user);
  const normalizedToken = normalizeToken(token);

  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  const targetStorage = rememberMe ? localStorageSafe : sessionStorageSafe;
  const otherStorage = rememberMe ? sessionStorageSafe : localStorageSafe;

  if (!targetStorage || !normalizedUser || !normalizedToken) {
    clearSession();
    return false;
  }

  clearKeys(otherStorage, [USER_KEY, ACCESS_TOKEN_KEY]);

  safeSet(targetStorage, USER_KEY, JSON.stringify(normalizedUser));
  safeSet(targetStorage, ACCESS_TOKEN_KEY, normalizedToken);

  if (localStorageSafe) {
    safeSet(
      localStorageSafe,
      SESSION_MODE_KEY,
      rememberMe ? SESSION_MODE_PERSISTENT : SESSION_MODE_TEMPORARY
    );
  }

  return true;
}

export function clearSession() {
  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  clearKeys(localStorageSafe, [USER_KEY, ACCESS_TOKEN_KEY, SESSION_MODE_KEY]);
  clearKeys(sessionStorageSafe, [USER_KEY, ACCESS_TOKEN_KEY, SESSION_MODE_KEY]);
}

export function hasSession() {
  const { token, user } = getResolvedSession();
  return !!token && !!user;
}

export function isPersistentSession() {
  const localStorageSafe = getLocalStorageSafe();
  const storedMode = safeGet(localStorageSafe, SESSION_MODE_KEY);

  return storedMode === SESSION_MODE_PERSISTENT;
}

export function getSessionMode() {
  const resolved = getResolvedSession();

  if (resolved.mode === SESSION_MODE_PERSISTENT) {
    return SESSION_MODE_PERSISTENT;
  }

  return SESSION_MODE_TEMPORARY;
}

export function getSessionSnapshot() {
  return getResolvedSession();
}