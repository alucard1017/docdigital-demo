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

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => normalizeUser(getStoredUser()));
  const [token, setTokenState] = useState(() => normalizeToken(getStoredToken()));
  const [authLoading, setAuthLoading] = useState(true);

  const authEventHandledRef = useRef(false);

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

  const isAuthenticated = !!token && !!user;

  const login = useCallback(async ({ identifier, password, rememberMe = false }) => {
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
    resetAuthExpiredDispatch();

    return data;
  }, []);

  const logout = useCallback((options = {}) => {
    const redirectTo = options.redirectTo || null;
    const replace = options.replace !== false;

    clearSession();
    setUserState(null);
    setTokenState("");
    resetAuthExpiredDispatch();

    if (import.meta.env.DEV) {
      console.warn("[AUTH] logout ejecutado", {
        redirectTo,
        reason: options.reason || null,
      });
    }

    if (redirectTo) {
      if (replace) {
        replaceTo(redirectTo);
      } else {
        navigateTo(redirectTo);
      }
    }
  }, []);

  useEffect(() => {
    const handleAuthExpired = (event) => {
      if (authEventHandledRef.current) return;
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

      window.setTimeout(() => {
        authEventHandledRef.current = false;
      }, 800);
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

      if (token) {
        setSession(normalizedUser, token, {
          rememberMe: getSessionMode() === "persistent",
        });
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