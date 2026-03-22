// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const Sentry = require("@sentry/node");
const { logAuth } = require("../utils/auditLog");

const router = express.Router();

/* ========= Configuración JWT ========= */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET no está definido en variables de entorno");
}

/* ========= Helpers ========= */

// Normalizar RUN: quitar puntos y guiones
const normalizeRun = (run) => (run || "").replace(/[.\-]/g, "");

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

/* ========= Middleware de autenticación ========= */

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!JWT_SECRET) {
      console.error("❌ requireAuth sin JWT_SECRET configurado");
      return res
        .status(500)
        .json({ message: "Configuración de servidor incompleta" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        console.warn("⚠️ Token expirado en requireAuth:", {
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

/* ========= Middleware de autorización por rol ========= */

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const role = req.user.role;

    // SUPER_ADMIN siempre pasa
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
    if (!JWT_SECRET) {
      console.error("❌ Intento de login sin JWT_SECRET configurado");
      return res
        .status(500)
        .json({ message: "Configuración de servidor incompleta" });
    }

    const { identifier, password } = req.body || {};

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

    let token;
    try {
      token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" });
    } catch (err) {
      console.error("❌ Error firmando JWT en /api/auth/login:", err);
      Sentry.captureException(err);
      return res
        .status(500)
        .json({ message: "Error interno al generar el token" });
    }

    await logAuth({
      userId: user.id,
      run: user.run,
      action: "LOGIN_SUCCESS",
      metadata: { role: user.role, company_id: user.company_id ?? null },
      req,
    });

    return res.json({
      token,
      user: tokenPayload,
    });
  } catch (err) {
    console.error("❌ Error inesperado en /api/auth/login:", err);
    Sentry.captureException(err);
    return res
      .status(500)
      .json({ message: "Error interno del servidor en login" });
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
