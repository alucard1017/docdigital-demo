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
  return user && typeof user === "object" ? user : null;
}

function getTokenFromAnyStorage() {
  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  return (
    safeGet(localStorageSafe, ACCESS_TOKEN_KEY) ||
    safeGet(sessionStorageSafe, ACCESS_TOKEN_KEY) ||
    ""
  );
}

function getUserFromAnyStorage() {
  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  const raw =
    safeGet(localStorageSafe, USER_KEY) ||
    safeGet(sessionStorageSafe, USER_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return normalizeUser(parsed);
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return getTokenFromAnyStorage();
}

export function getStoredUser() {
  return getUserFromAnyStorage();
}

export function setSession(user, token, options = {}) {
  const { rememberMe = false } = options;

  const normalizedUser = normalizeUser(user);
  const normalizedToken = normalizeToken(token);

  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  const targetStorage = rememberMe ? localStorageSafe : sessionStorageSafe;
  const otherStorage = rememberMe ? sessionStorageSafe : localStorageSafe;

  if (!targetStorage) return false;

  safeRemove(otherStorage, USER_KEY);
  safeRemove(otherStorage, ACCESS_TOKEN_KEY);

  if (normalizedUser) {
    safeSet(targetStorage, USER_KEY, JSON.stringify(normalizedUser));
  } else {
    safeRemove(targetStorage, USER_KEY);
  }

  if (normalizedToken) {
    safeSet(targetStorage, ACCESS_TOKEN_KEY, normalizedToken);
  } else {
    safeRemove(targetStorage, ACCESS_TOKEN_KEY);
  }

  safeSet(
    localStorageSafe,
    SESSION_MODE_KEY,
    rememberMe ? SESSION_MODE_PERSISTENT : SESSION_MODE_TEMPORARY
  );

  return true;
}

export function clearSession() {
  const localStorageSafe = getLocalStorageSafe();
  const sessionStorageSafe = getSessionStorageSafe();

  safeRemove(localStorageSafe, USER_KEY);
  safeRemove(localStorageSafe, ACCESS_TOKEN_KEY);
  safeRemove(localStorageSafe, SESSION_MODE_KEY);

  safeRemove(sessionStorageSafe, USER_KEY);
  safeRemove(sessionStorageSafe, ACCESS_TOKEN_KEY);
}

export function hasSession() {
  return !!getStoredToken() && !!getStoredUser();
}

export function isPersistentSession() {
  const localStorageSafe = getLocalStorageSafe();
  return (
    safeGet(localStorageSafe, SESSION_MODE_KEY) === SESSION_MODE_PERSISTENT
  );
}

export function getSessionMode() {
  return isPersistentSession()
    ? SESSION_MODE_PERSISTENT
    : SESSION_MODE_TEMPORARY;
}