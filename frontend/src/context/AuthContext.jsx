import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { resetAuthExpiredDispatch } from "../api/client";
import {
  clearSession,
  getSessionMode,
  getStoredToken,
  getStoredUser,
  setSession,
} from "../utils/session";
import { navigateTo, replaceTo } from "../utils/router";

export const AuthContext = createContext(null);

const LOGOUT_RELEASE_DELAY_MS = 500;
const AUTH_EVENT_RESET_DELAY_MS = 1000;

function normalizeToken(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
}

function normalizeUser(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getCurrentPath() {
  if (!isBrowser()) return "";
  return window.location?.pathname || "";
}

function clearTimer(timerRef) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function getLoginErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "No se pudo conectar con el servidor de autenticación."
  );
}

function getRememberMeOption() {
  return getSessionMode() === "persistent";
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => normalizeUser(getStoredUser()));
  const [token, setTokenState] = useState(() => normalizeToken(getStoredToken()));
  const [authLoading, setAuthLoading] = useState(true);

  const authEventHandledRef = useRef(false);
  const logoutInProgressRef = useRef(false);
  const authResetTimerRef = useRef(null);
  const logoutReleaseTimerRef = useRef(null);

  const isAuthenticated = Boolean(token && user);

  const hydrateSession = useCallback(() => {
    const storedUser = normalizeUser(getStoredUser());
    const storedToken = normalizeToken(getStoredToken());

    setUserState(storedUser);
    setTokenState(storedToken);

    return {
      user: storedUser,
      token: storedToken,
      isAuthenticated: Boolean(storedUser && storedToken),
    };
  }, []);

  const clearRuntimeFlags = useCallback(() => {
    authEventHandledRef.current = false;
    logoutInProgressRef.current = false;
    resetAuthExpiredDispatch();
  }, []);

  useEffect(() => {
    hydrateSession();
    setAuthLoading(false);
  }, [hydrateSession]);

  useEffect(() => {
    return () => {
      clearTimer(authResetTimerRef);
      clearTimer(logoutReleaseTimerRef);
    };
  }, []);

  const commitSession = useCallback(
    (nextUser, nextToken, options = {}) => {
      const normalizedUser = normalizeUser(nextUser);
      const normalizedToken = normalizeToken(nextToken);
      const rememberMe = Boolean(options.rememberMe);

      if (!normalizedUser || !normalizedToken) {
        throw new Error("Datos de sesión inválidos");
      }

      setSession(normalizedUser, normalizedToken, { rememberMe });
      setUserState(normalizedUser);
      setTokenState(normalizedToken);
      clearRuntimeFlags();

      return {
        user: normalizedUser,
        token: normalizedToken,
      };
    },
    [clearRuntimeFlags]
  );

  const clearAuthState = useCallback(() => {
    clearSession();
    setUserState(null);
    setTokenState("");
    resetAuthExpiredDispatch();
  }, []);

  const login = useCallback(async ({ identifier, password, rememberMe = false }) => {
    const payload = {
      identifier: typeof identifier === "string" ? identifier.trim() : "",
      password: typeof password === "string" ? password : "",
      rememberMe: Boolean(rememberMe),
    };

    if (!payload.identifier || !payload.password) {
      throw new Error("Debes ingresar identificador y contraseña");
    }

    let res;
    try {
      res = await api.post("/auth/login", payload, {
        withCredentials: true,
      });
    } catch (error) {
      throw new Error(getLoginErrorMessage(error));
    }

    const data = res?.data;
    const nextUser = normalizeUser(data?.user);
    const nextToken = normalizeToken(data?.accessToken);

    if (!nextUser || !nextToken) {
      throw new Error("Respuesta inesperada del servidor de autenticación");
    }

    commitSession(nextUser, nextToken, {
      rememberMe: payload.rememberMe,
    });

    return data;
  }, [commitSession]);

  const logout = useCallback((options = {}) => {
    if (logoutInProgressRef.current) return;

    logoutInProgressRef.current = true;

    const redirectTo = options.redirectTo || null;
    const replace = options.replace !== false;
    const reason = options.reason || null;
    const currentPath = getCurrentPath();

    clearAuthState();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[AUTH] logout ejecutado", {
        redirectTo,
        currentPath,
        reason,
      });
    }

    if (redirectTo && currentPath !== redirectTo && isBrowser()) {
      if (replace) {
        replaceTo(redirectTo);
      } else {
        navigateTo(redirectTo);
      }
    }

    clearTimer(logoutReleaseTimerRef);

    if (isBrowser()) {
      logoutReleaseTimerRef.current = window.setTimeout(() => {
        logoutInProgressRef.current = false;
      }, LOGOUT_RELEASE_DELAY_MS);
    } else {
      logoutInProgressRef.current = false;
    }
  }, [clearAuthState]);

  const updateUser = useCallback(
    (nextUser) => {
      const normalizedUser = normalizeUser(nextUser);

      setUserState(normalizedUser);

      if (token && normalizedUser) {
        setSession(normalizedUser, token, {
          rememberMe: getRememberMeOption(),
        });
      }

      if (!normalizedUser && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[AUTH] updateUser recibió usuario inválido/null");
      }
    },
    [token]
  );

  const setUser = useCallback((nextUser) => {
    setUserState(normalizeUser(nextUser));
  }, []);

  const setToken = useCallback((nextToken) => {
    setTokenState(normalizeToken(nextToken));
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;

    const handleAuthExpired = (event) => {
      if (authEventHandledRef.current || logoutInProgressRef.current) {
        return;
      }

      authEventHandledRef.current = true;

      const detail = event?.detail ?? null;

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[AUTH] sesión invalidada por evento global:", {
          source: detail?.source,
          message: detail?.message,
          code: detail?.code,
          status: detail?.status,
          url: detail?.url,
          method: detail?.method,
        });
      }

      logout({
        redirectTo: "/login",
        replace: true,
        reason: detail,
      });

      clearTimer(authResetTimerRef);

      authResetTimerRef.current = window.setTimeout(() => {
        authEventHandledRef.current = false;
      }, AUTH_EVENT_RESET_DELAY_MS);
    };

    window.addEventListener("auth:expired", handleAuthExpired);

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, [logout]);

  useEffect(() => {
    if (!isBrowser()) return;

    const onStorageSync = () => {
      hydrateSession();
    };

    window.addEventListener("storage", onStorageSync);

    return () => {
      window.removeEventListener("storage", onStorageSync);
    };
  }, [hydrateSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      authLoading,
      isAuthenticated,
      login,
      logout,
      updateUser,
      hydrateSession,
      setUser,
      setToken,
    }),
    [
      user,
      token,
      authLoading,
      isAuthenticated,
      login,
      logout,
      updateUser,
      hydrateSession,
      setUser,
      setToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}