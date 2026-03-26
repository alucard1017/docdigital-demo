// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const Sentry = require("@sentry/node");
const { logAuth } = require("../utils/auditLog");

const router = express.Router();

/* ========= Configuración JWT ========= */

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET) {
  console.error("❌ JWT_ACCESS_SECRET (o JWT_SECRET) no está definido");
}
if (!JWT_REFRESH_SECRET) {
  console.error("❌ JWT_REFRESH_SECRET no está definido en variables de entorno");
}

/* ========= Helpers ========= */

const normalizeRun = (run) => (run || "").replace(/[.\-]/g, "");

// genera access token corto
function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

// genera refresh token (vida más larga)
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

// setea cookies httpOnly
function setAuthCookies(res, accessToken, refreshToken, rememberMe) {
  const commonOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  // access token: siempre cookie de sesión (no persistente)
  res.cookie("access_token", accessToken, {
    ...commonOptions,
  });

  // refresh token: si rememberMe => persistente, si no => sesión
  const refreshOptions = { ...commonOptions };
  if (rememberMe) {
    // ~30 días
    refreshOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
  }
  res.cookie("refresh_token", refreshToken, refreshOptions);
}

// limpia cookies
function clearAuthCookies(res) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
}

/* ========= Middleware de autenticación basado en access_token (cookie o header) ========= */

function requireAuth(req, res, next) {
  try {
    let token = null;

    // Prioridad: cookie httpOnly
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else {
      const header = req.headers.authorization || "";
      if (header.startsWith("Bearer ")) {
        token = header.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!JWT_ACCESS_SECRET) {
      console.error("❌ requireAuth sin JWT_ACCESS_SECRET configurado");
      return res
        .status(500)
        .json({ message: "Configuración de servidor incompleta" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        console.warn("⚠️ Token de acceso expirado en requireAuth:", {
          expiredAt: err.expiredAt,
        });
        return res.status(401).json({ message: "Token expirado" });
      }

      console.error("❌ Token inválido en requireAuth:", err);
      return res.status(401).json({ message: "Token inválido" });
    }

    req.user = {
      id: payload.id,
      run: payload.run,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      company_id: payload.company_id ?? null,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG REQ.USER en requireAuth:", req.user);
    }

    Sentry.setUser({
      id: String(payload.id),
      username: payload.name || undefined,
      email: payload.email || undefined,
    });
    Sentry.setTag("user_role", payload.role || "unknown");
    Sentry.setTag("user_company", String(payload.company_id || "none"));
    if (req.requestId) {
      Sentry.setTag("request_id", req.requestId);
    }

    return next();
  } catch (err) {
    console.error("❌ Error inesperado en requireAuth:", err);
    Sentry.captureException(err);
    return res
      .status(500)
      .json({ message: "Error interno en autenticación" });
  }
}

/* ========= Helpers de permisos sobre usuarios ========= */

function canManageAllUsers(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function canManageCompanyUsers(user) {
  return (
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN_GLOBAL"
  );
}

function isProtectedUser(targetUser) {
  return targetUser?.role === "SUPER_ADMIN";
}

/* ========= Middleware de autorización por rol ========= */

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const role = req.user.role;

    if (role === "SUPER_ADMIN") {
      return next();
    }

    if (requiredRole === "ADMIN_GLOBAL") {
      if (role !== "ADMIN_GLOBAL") {
        return res.status(403).json({ message: "Permisos insuficientes" });
      }
      return next();
    }

    if (requiredRole === "ADMIN") {
      if (role !== "ADMIN" && role !== "ADMIN_GLOBAL") {
        return res.status(403).json({ message: "Permisos insuficientes" });
      }
      return next();
    }

    if (role !== requiredRole) {
      return res.status(403).json({ message: "Permisos insuficientes" });
    }

    return next();
  };
}

/* ========= POST /api/auth/login ========= */

router.post("/login", async (req, res) => {
  try {
    if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
      console.error("❌ Intento de login sin secretos JWT configurados");
      return res
        .status(500)
        .json({ message: "Configuración de servidor incompleta" });
    }

    const { identifier, password, rememberMe } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "RUN o correo y contraseña son obligatorios" });
    }

    const rawIdentifier = String(identifier).trim();
    const isEmail = rawIdentifier.includes("@");

    const normalizedIdentifier = isEmail
      ? rawIdentifier.toLowerCase()
      : normalizeRun(rawIdentifier);

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG /api/auth/login body:", {
        rawIdentifier,
        normalizedIdentifier,
        isEmail,
        rememberMe: !!rememberMe,
      });
    }

    if (!db || typeof db.query !== "function") {
      console.error("❌ db.query no está disponible");
      return res
        .status(500)
        .json({ message: "Error de conexión con la base de datos" });
    }

    const query = isEmail
      ? `SELECT * FROM public.users WHERE email = $1`
      : `SELECT * FROM public.users WHERE run = $1`;

    let result;
    try {
      result = await db.query(query, [normalizedIdentifier]);
    } catch (dbErr) {
      console.error("❌ Error ejecutando query en /api/auth/login:", dbErr);
      Sentry.captureException(dbErr);
      return res
        .status(500)
        .json({ message: "Error de base de datos en login" });
    }

    const user = result.rows[0];

    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Login fallido: usuario no encontrado",
          isEmail
            ? { by: "email", email: normalizedIdentifier }
            : { by: "run", run: normalizedIdentifier }
        );
      }

      await logAuth({
        userId: null,
        run: isEmail ? null : normalizedIdentifier,
        action: "LOGIN_FAILED",
        metadata: { reason: "user_not_found", isEmail },
        req,
      });

      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    if (user.active === false) {
      await logAuth({
        userId: user.id,
        run: user.run,
        action: "LOGIN_FAILED",
        metadata: { reason: "user_inactive" },
        req,
      });

      return res
        .status(401)
        .json({ message: "Cuenta desactivada, contacta al administrador" });
    }

    if (!user.password_hash) {
      console.warn("Usuario sin password_hash, id:", user.id);

      await logAuth({
        userId: user.id,
        run: user.run,
        action: "LOGIN_FAILED",
        metadata: { reason: "missing_password_hash" },
        req,
      });

      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    let ok;
    try {
      ok = await bcrypt.compare(password, user.password_hash);
    } catch (cmpErr) {
      console.error("❌ Error comparando password en /api/auth/login:", cmpErr);
      Sentry.captureException(cmpErr);
      return res
        .status(500)
        .json({ message: "Error interno al validar la contraseña" });
    }

    if (!ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Login fallido: contraseña incorrecta para usuario id:",
          user.id
        );
      }

      await logAuth({
        userId: user.id,
        run: user.run,
        action: "LOGIN_FAILED",
        metadata: { reason: "bad_password" },
        req,
      });

      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const tokenPayload = {
      id: user.id,
      run: user.run,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id ?? null,
    };

    let accessToken;
    let refreshToken;
    try {
      accessToken = signAccessToken(tokenPayload);
      refreshToken = signRefreshToken({ id: user.id });
    } catch (err) {
      console.error("❌ Error firmando JWT en /api/auth/login:", err);
      Sentry.captureException(err);
      return res
        .status(500)
        .json({ message: "Error interno al generar los tokens" });
    }

    // Opcional: aquí podrías guardar refreshToken (o su jti) en BD para poder revocarlo.

    setAuthCookies(res, accessToken, refreshToken, !!rememberMe);

    await logAuth({
      userId: user.id,
      run: user.run,
      action: "LOGIN_SUCCESS",
      metadata: {
        role: user.role,
        company_id: user.company_id ?? null,
        rememberMe: !!rememberMe,
      },
      req,
    });

    return res.json({
      user: tokenPayload,
      accessToken,      // nuevo
    });

  } catch (err) {
    console.error("❌ Error inesperado en /api/auth/login:", err);
    Sentry.captureException(err);
    return res
      .status(500)
      .json({ message: "Error interno del servidor en login" });
  }
});

/* ========= POST /api/auth/refresh ========= */

router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ message: "No hay refresh token" });
    }

    if (!JWT_REFRESH_SECRET || !JWT_ACCESS_SECRET) {
      console.error("❌ /refresh sin secretos configurados");
      return res
        .status(500)
        .json({ message: "Configuración de servidor incompleta" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      console.error("❌ Refresh token inválido o expirado:", err);
      return res.status(401).json({ message: "Refresh token inválido" });
    }

    // Aquí podrías comprobar en BD que el refresh token no esté revocado.

    // Releer usuario por seguridad (rol actualizado, etc.)
    const userRes = await db.query(
      `SELECT id, run, email, name, role, company_id FROM public.users WHERE id = $1`,
      [payload.id]
    );
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const tokenPayload = {
      id: user.id,
      run: user.run,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id ?? null,
    };

    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken({ id: user.id });

    setAuthCookies(res, newAccessToken, newRefreshToken, true); // aquí asumimos que ya quiso "recordarme"

    return res.json({ user: tokenPayload });
  } catch (err) {
    console.error("❌ Error en /api/auth/refresh:", err);
    Sentry.captureException(err);
    return res
      .status(500)
      .json({ message: "Error interno en refresh de sesión" });
  }
});

/* ========= POST /api/auth/logout ========= */

router.post("/logout", async (req, res) => {
  try {
    clearAuthCookies(res);
    // aquí podrías marcar el refresh token como revocado en BD
    return res.json({ message: "Sesión cerrada correctamente" });
  } catch (err) {
    console.error("❌ Error en /api/auth/logout:", err);
    Sentry.captureException(err);
    return res
      .status(500)
      .json({ message: "Error interno al cerrar sesión" });
  }
});

/* ========= GET /api/auth/me ========= */

router.get("/me", requireAuth, (req, res) => {
  return res.json({
    id: req.user.id,
    run: req.user.run,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    company_id: req.user.company_id ?? null,
  });
});

/* ========= Verificación de email ========= */

const {
  sendVerificationEmail,
  verifyEmail,
} = require("../controllers/auth/emailVerification");

router.post("/send-verification", sendVerificationEmail);
router.post("/verify-email", verifyEmail);

/* ========= Reset de contraseña ========= */

const {
  forgotPassword,
  resetPassword,
} = require("../controllers/auth/passwordReset");

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* ========= Exports ========= */

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;
module.exports.canManageAllUsers = canManageAllUsers;
module.exports.canManageCompanyUsers = canManageCompanyUsers;
module.exports.isProtectedUser = isProtectedUser;