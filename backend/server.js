// backend/server.js

/* ================================
   CARGA DE VARIABLES DE ENTORNO
   ================================ */
const envFile =
  process.env.NODE_ENV === "development" ? ".env.development" : ".env";

require("dotenv").config({ path: envFile });
require("./instrument"); // Inicializa Sentry antes de todo

/* ================================
   IMPORTS PRINCIPALES
   ================================ */
const express = require("express");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const Sentry = require("@sentry/node");

const requestMeta = require("./middlewares/requestMeta");
const db = require("./db");
const { setupSwagger } = require("./swagger");
const { requireAuth, requireRole } = require("./routes/auth");


/* ================================
   INICIALIZAR WORKER DE BULLMQ (BACKGROUND JOBS)
   ================================ */
try {
  // require("./queues/remindersWorker");
  console.log("✓ Worker de recordatorios inicializado");
} catch (err) {
  console.warn(
    "⚠️ No se pudo iniciar worker de recordatorios:",
    err.message
  );
}

/* ================================
   INICIALIZAR REMINDER SCHEDULER (CRON)
   ================================ */
try {
  const { iniciarReminderScheduler } = require("./jobs/reminderScheduler");
  iniciarReminderScheduler();
  console.log("✓ Scheduler de recordatorios iniciado");
} catch (err) {
  console.warn(
    "⚠️ No se pudo iniciar reminderScheduler:",
    err.message
  );
}

/* ================================
   RUTAS
   ================================ */
const authRoutes = require("./routes/auth");
const docRoutes = require("./routes/documents");
const publicRoutes = require("./routes/public");
const usersRouter = require("./routes/users");
const publicRegisterRoutes = require("./routes/publicRegister");
const companiesRoutes = require("./routes/companies");
const statusRoutes = require("./routes/status");
const logsRoutes = require("./routes/logs");
const remindersRoutes = require("./routes/reminders");
const analyticsRoutes = require("./routes/analytics");

/* ================================
   LOG DE INICIO
   ================================ */
console.log("=====================================");
console.log("🚀 INICIANDO SERVER.JS");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Usando archivo de entorno:", envFile);
console.log("=====================================");

const app = express();

// Confiar en proxy (Render/Nginx) para X-Forwarded-For
app.set("trust proxy", 1);

// Metadatos de request (requestId, ip, userAgent)
app.use(requestMeta);

/* ================================
   BODY PARSERS
   ================================ */
app.use(
  express.json({
    limit: "2mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

/* ================================
   SECURITY HEADERS (HELMET)
   ================================ */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false, // permitir PDF embebido en iframe
  })
);
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());
app.use(
  helmet.referrerPolicy({
    policy: "no-referrer",
  })
);

if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.hsts({
      maxAge: 15552000, // 180 días
      includeSubDomains: true,
      preload: false,
    })
  );
}

/* ================================
   VALIDAR VARIABLES DE ENTORNO
   ================================ */
const requiredEnvVars = [
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.warn("⚠️  Variables de entorno faltantes:", missingVars.join(", "));
}
console.log("✓ Variables de entorno validadas");

/* ================================
   RATE LIMITING GLOBAL
   ================================ */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes, intenta después" },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos de login, intenta después" },
});

const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes desde este origen. Intenta más tarde.",
  },
});

app.use(generalLimiter);

/* ================================
   CORS MANUAL
   ================================ */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://verifirma-frontend.onrender.com",
  "https://www.verifirma.cl",
  "https://verifirma.cl",
  "https://app.verifirma.cl",
  "https://firmar.verifirma.cl",
  "https://verificar.verifirma.cl",
  "https://docdigital.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin || "";

  if (origin) {
    res.header("Vary", "Origin");
  }

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* ================================
   ARCHIVOS PÚBLICOS (HTML VERIFICACIÓN)
   ================================ */
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use("/public", express.static(publicDir));

app.get("/public/verificar", (req, res) => {
  res.sendFile(path.join(publicDir, "verificar.html"));
});
console.log("✓ Ruta pública /public/verificar registrada");

/* ================================
   SWAGGER / DOCUMENTACIÓN API
   ================================ */
setupSwagger(app);
console.log("✓ Swagger UI disponible en /api-docs");

/* ================================
   RUTAS DE SALUD / INFO
   ================================ */
app.get("/api/health", async (req, res) => {
  try {
    const uptime = process.uptime();
    let dbStatus = "unknown";

    try {
      const r = await db.query("SELECT 1 AS ok");
      dbStatus = r.rows[0].ok === 1 ? "ok" : "error";
    } catch (dbErr) {
      console.error("❌ /api/health DB error:", dbErr);
      dbStatus = "error";
    }

    const status = dbStatus === "ok" ? "ok" : "degraded";

    res.status(status === "ok" ? 200 : 503).json({
      status,
      uptime_seconds: Math.round(uptime),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        storage: process.env.R2_BUCKET ? "configured" : "not_configured",
      },
    });
  } catch (e) {
    console.error("❌ Error en /api/health:", e);
    res.status(500).json({
      status: "error",
      message: "Error en health",
      timestamp: new Date().toISOString(),
    });
  }
});
console.log("✓ Ruta GET /api/health registrada");

app.get("/api/info", (req, res) => {
  res.json({
    message: "API de VeriFirma funcionando",
    version: "2.0",
    features: [
      "autenticación",
      "documentos",
      "firma digital",
      "R2 storage",
      "swagger docs",
    ],
    timestamp: new Date().toISOString(),
  });
});
console.log("✓ Ruta GET /api/info registrada");

/* ================================
   RUTA DE PRUEBA SENTRY
   ================================ */
app.get("/api/sentry-test", (req, res) => {
  throw new Error("Sentry test error");
});
console.log("✓ Ruta GET /api/sentry-test registrada");

/* ================================
   RUTAS PRINCIPALES API
   ================================ */

// Auth
app.use("/api/auth", loginLimiter, authRoutes);
console.log("✓ Rutas /api/auth registradas");

// Usuarios
app.use("/api/users", usersRouter);
console.log("✓ Rutas /api/users registradas");

// Estado del sistema
app.use("/api/status", statusRoutes);
console.log("✓ Rutas /api/status registradas");

// Logs / auditoría
app.use("/api/logs", logsRoutes);
console.log("✓ Rutas /api/logs registradas");

// Documentos (alias antiguo + nuevo prefijo)
app.use(
  "/api/docs",
  (req, res, next) => {
    console.log(`DEBUG DOCS (alias) >> ${req.method} ${req.originalUrl}`);
    next();
  },
  docRoutes
);

app.use(
  "/api/documents",
  (req, res, next) => {
    console.log(`DEBUG DOCUMENTS >> ${req.method} ${req.originalUrl}`);
    next();
  },
  docRoutes
);
console.log("✓ Rutas /api/documents registradas");

// Público (firma, visado, verificación por token)
app.use(
  "/api/public",
  publicLimiter,
  (req, res, next) => {
    console.log(`DEBUG PUBLIC >> ${req.method} ${req.originalUrl}`);
    next();
  },
  publicRoutes
);
console.log("✓ Rutas /api/public registradas");

// Registro público (autoregistro de empresas/usuarios)
app.use("/api/public", publicRegisterRoutes);
console.log("✓ Rutas /api/public/register registradas");

// Empresas
app.use("/api/companies", companiesRoutes);
console.log("✓ Rutas /api/companies registradas");

// Recordatorios
app.use("/api/reminders", remindersRoutes);
console.log("✓ Rutas /api/reminders registradas");

// Analytics
app.use("/api/analytics", analyticsRoutes);
console.log("✓ Rutas /api/analytics registradas");

/* ================================
   RUTA STORAGE / URLs FIRMADAS
   ================================ */
app.get("/api/s3/download/:fileKey", requireAuth, async (req, res) => {
  try {
    const { getSignedUrl } = require("./services/s3");
    const fileKey = req.params.fileKey;

    const docCheck = await db.query(
      `SELECT id 
       FROM documents 
       WHERE file_path LIKE $1 AND owner_id = $2 
       LIMIT 1`,
      [`%${fileKey}%`, req.user.id]
    );

    if (docCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "No tienes acceso a este archivo" });
    }

    const signedUrl = getSignedUrl(fileKey, 3600);
    res.json({ url: signedUrl, expires_in: 3600 });
  } catch (error) {
    console.error("❌ Error generando URL de descarga:", error);
    res.status(500).json({ error: "Error al descargar archivo" });
  }
});
console.log("✓ Ruta GET /api/s3/download/:fileKey registrada");

/* ================================
   RUTAS DE PRUEBA / ADMIN
   ================================ */
app.get("/api/admin/ping", requireAuth, requireRole("admin"), (req, res) => {
  return res.json({
    message: "Solo admin puede ver esto",
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});
console.log("✓ Ruta GET /api/admin/ping registrada");

/* ================================
   DEBUG AUTH
   ================================ */
app.get("/api/test-auth", (req, res) => {
  console.log("📍 GET /api/test-auth llamado");
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  res.json({
    token_recibido: token ? "sí" : "no",
    token,
    header_completo: header || "ninguno",
  });
});
console.log("✓ Ruta GET /api/test-auth registrada");

/* ================================
   RECORDATORIOS LEGACY
   ================================ */
app.post(
  "/api/recordatorios/pendientes",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { sendReminderEmail } = require("./services/sendReminderEmails");

      const docResult = await db.query(
        `SELECT id, firmante_email, firmante_nombre, title, signature_token_expires_at
         FROM documents 
         WHERE signature_status = 'PENDIENTE' 
           AND created_at > NOW() - INTERVAL '30 días'
         ORDER BY created_at DESC`
      );

      const documentosPendientes = docResult.rows;
      let enviados = 0;
      let errores = 0;

      for (const doc of documentosPendientes) {
        try {
          const ok = await sendReminderEmail({
            signer_email: doc.firmante_email,
            signer_name: doc.firmante_nombre,
            nombre: doc.title,
            estado: "PENDIENTE",
          });
          if (ok) enviados++;
        } catch (emailError) {
          console.error(
            `⚠️  Error enviando recordatorio para doc ${doc.id}:`,
            emailError.message
          );
          errores++;
        }
      }

      return res.json({
        mensaje: "Recordatorios procesados",
        total: documentosPendientes.length,
        enviados,
        errores,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error en recordatorios:", error);
      return res.status(500).json({
        error: "Error en el servidor al enviar recordatorios",
        detalles: error.message,
      });
    }
  }
);
console.log("✓ Ruta POST /api/recordatorios/pendientes registrada");

/* ================================
   ESTADÍSTICAS
   ================================ */
app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const docsResult = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('PENDIENTE_VISADO', 'PENDIENTE_FIRMA') THEN 1 ELSE 0 END) as pendientes,
         SUM(CASE WHEN status = 'VISADO' THEN 1 ELSE 0 END) as visados,
         SUM(CASE WHEN status = 'FIRMADO' THEN 1 ELSE 0 END) as firmados,
         SUM(CASE WHEN status = 'RECHAZADO' THEN 1 ELSE 0 END) as rechazados
       FROM documents 
       WHERE owner_id = $1`,
      [req.user.id]
    );

    const stats = docsResult.rows[0];

    res.json({
      documentos: stats,
      usuario: req.user.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error obteniendo stats:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});
console.log("✓ Ruta GET /api/stats registrada");

/* ================================
   SERVIR FRONTEND (REACT)
   ================================ */
const frontendDir = path.join(__dirname, "..", "frontend", "dist");

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));

  app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/public")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDir, "index.html"));
  });

  console.log("✓ Frontend estático servido desde", frontendDir);
} else {
  console.warn("⚠️  Frontend no encontrado en", frontendDir);
}

/* ================================
   MIDDLEWARE GLOBAL DE ERRORES
   ================================ */
Sentry.setupExpressErrorHandler(app);
const errorHandler = require("./middlewares/errorHandler");
app.use(errorHandler);

/* ================================
   RUTA 404
   ================================ */
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});
console.log("✓ Middleware 404 registrado");

/* ================================
   INICIAR SERVIDOR
   ================================ */
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log("=====================================");
  console.log(`✅ API ESCUCHANDO EN PUERTO ${PORT}`);
  console.log("=====================================");
  console.log("📋 Rutas principales:");
  console.log("   GET  /api-docs");
  console.log("   GET  /api/health");
  console.log("   GET  /api/info");
  console.log("   GET  /api/sentry-test");
  console.log("   GET  /api/stats");
  console.log("   /api/status ...");
  console.log("   /api/logs ...");
  console.log("   /api/auth ...");
  console.log("   /api/users ...");
  console.log("   /api/docs ...");
  console.log("   /api/public ...");
  console.log("   /api/companies ...");
  console.log("=====================================");
  console.log(`🌍 FRONTEND_URL: ${process.env.FRONTEND_URL || "no configurada"}`);
  console.log(
    `☁️  STORAGE (R2_BUCKET): ${process.env.R2_BUCKET || "no configurado"}`
  );
  console.log("=====================================");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

module.exports = app;