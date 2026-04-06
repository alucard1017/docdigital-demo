// frontend/src/context/AuthContext.jsx
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

function normalizeToken(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUser(value) {
  return value && typeof value === "object" ? value : null;
}

function getCurrentPath() {
  if (typeof window === "undefined") return "";
  return window.location?.pathname || "";
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => normalizeUser(getStoredUser()));
  const [token, setTokenState] = useState(() => normalizeToken(getStoredToken()));
  const [authLoading, setAuthLoading] = useState(true);

  const authEventHandledRef = useRef(false);
  const logoutInProgressRef = useRef(false);
  const authResetTimerRef = useRef(null);
  const logoutReleaseTimerRef = useRef(null);

  const hydrateSession = useCallback(() => {
    const storedUser = normalizeUser(getStoredUser());
    const storedToken = normalizeToken(getStoredToken());

    setUserState(storedUser);
    setTokenState(storedToken);
  }, []);

  useEffect(() => {
    hydrateSession();
    setAuthLoading(false);
  }, [hydrateSession]);

  useEffect(() => {
    return () => {
      if (authResetTimerRef.current) {
        clearTimeout(authResetTimerRef.current);
      }
      if (logoutReleaseTimerRef.current) {
        clearTimeout(logoutReleaseTimerRef.current);
      }
    };
  }, []);

  const isAuthenticated = !!token && !!user;

  const login = useCallback(
    async ({ identifier, password, rememberMe = false }) => {
      const res = await api.post(
        "/auth/login",
        { identifier, password, rememberMe },
        { withCredentials: true }
      );

      const data = res.data;

      if (!data?.user || !data?.accessToken) {
        throw new Error("Respuesta inesperada del servidor de autenticación");
      }

      const nextUser = normalizeUser(data.user);
      const nextToken = normalizeToken(data.accessToken);

      if (!nextUser || !nextToken) {
        throw new Error("Datos de sesión inválidos");
      }

      setSession(nextUser, nextToken, { rememberMe });
      setUserState(nextUser);
      setTokenState(nextToken);

      authEventHandledRef.current = false;
      logoutInProgressRef.current = false;
      resetAuthExpiredDispatch();

      return data;
    },
    []
  );

  const logout = useCallback((options = {}) => {
    if (logoutInProgressRef.current) return;

    logoutInProgressRef.current = true;

    const redirectTo = options.redirectTo || null;
    const replace = options.replace !== false;
    const reason = options.reason || null;
    const currentPath = getCurrentPath();

    clearSession();
    setUserState(null);
    setTokenState("");
    resetAuthExpiredDispatch();

    if (import.meta.env.DEV) {
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

    if (logoutReleaseTimerRef.current) {
      clearTimeout(logoutReleaseTimerRef.current);
    }

    logoutReleaseTimerRef.current = window.setTimeout(() => {
      logoutInProgressRef.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;

    const handleAuthExpired = (event) => {
      if (authEventHandledRef.current || logoutInProgressRef.current) {
        return;
      }

      authEventHandledRef.current = true;

      if (import.meta.env.DEV) {
        console.warn("[AUTH] sesión invalidada por evento global:", {
          source: event?.detail?.source,
          message: event?.detail?.message,
          code: event?.detail?.code,
          status: event?.detail?.status,
          url: event?.detail?.url,
          method: event?.detail?.method,
        });
      }

      logout({
        redirectTo: "/login",
        replace: true,
        reason: event?.detail || null,
      });

      if (authResetTimerRef.current) {
        clearTimeout(authResetTimerRef.current);
      }

      authResetTimerRef.current = window.setTimeout(() => {
        authEventHandledRef.current = false;
      }, 1000);
    };

    window.addEventListener("auth:expired", handleAuthExpired);

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, [logout]);

  const updateUser = useCallback(
    (nextUser) => {
      const normalizedUser = normalizeUser(nextUser);
      setUserState(normalizedUser);

      if (token && normalizedUser) {
        setSession(normalizedUser, token, {
          rememberMe: getSessionMode() === "persistent",
        });
      }

      if (!normalizedUser && import.meta.env.DEV) {
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