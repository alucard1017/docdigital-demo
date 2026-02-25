// backend/server.js
require("dotenv").config();
require("./instrument"); // inicializa Sentry v8 antes de todo

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const Sentry = require("@sentry/node");

console.log("=====================================");
console.log("🚀 INICIANDO SERVER.JS");
console.log("=====================================");

const app = express();
app.set("trust proxy", 1);

/* ================================
   SECURITY HEADERS (HELMET)
   ================================ */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(helmet.hidePoweredBy());
app.use(helmet.frameguard({ action: "sameorigin" }));
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
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

const missingVars = requiredEnvVars.filter((variable) => !process.env[variable]);
if (missingVars.length > 0) {
  console.warn("⚠️  Variables de entorno faltantes:", missingVars.join(", "));
}
console.log("✓ Variables de entorno validadas");

/* ================================
   RATE LIMITING
   ================================ */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Demasiadas solicitudes, intenta después",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de login, intenta después",
});

app.use(generalLimiter);

const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: "Demasiadas solicitudes desde este origen. Intenta más tarde.",
});

/* ================================
   MIDDLEWARES
   ================================ */

// Dominios permitidos para CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://verifirma-frontend.onrender.com",
  "https://www.verifirma.cl",
  "https://verifirma.cl",
  "https://app.verifirma.cl",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin || "";

  // Siempre decir que la respuesta varía según Origin
  if (origin) {
    res.header("Vary", "Origin");
  }

  // Si el origen está permitido, añadimos cabeceras CORS
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
  }

  // IMPORTANTE: aquí nunca lanzamos errores ni llamamos next(err)

  if (req.method === "OPTIONS") {
    // El preflight termina aquí y no llega al errorHandler
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

/* ================================
   ARCHIVOS PÚBLICOS (VERIFICACIÓN)
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
const { swaggerUi, specs } = require("./swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
console.log("✓ Swagger UI disponible en /api-docs");

/* ================================
   RUTAS DE SALUD / PING
   ================================ */
app.get("/api/health", (req, res) => {
  try {
    console.log("DEBUG HEALTH >> /api/health llamado");

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      s3_enabled: !!process.env.AWS_S3_BUCKET,
      database: process.env.DATABASE_URL ? "conectada" : "no configurada",
    });
  } catch (e) {
    console.error("❌ Error en /api/health:", e);
    res.status(500).json({ ok: false, message: "Error en health" });
  }
});
console.log("✓ Ruta GET /api/health registrada");

/* ================================
   INFO API
   ================================ */
app.get("/api/info", (req, res) => {
  res.json({
    message: "API de VeriFirma funcionando",
    version: "2.0",
    features: ["autenticación", "documentos", "firma digital", "S3 storage", "swagger docs"],
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
const authRoutes = require("./routes/auth");
const docRoutes = require("./routes/documents");
const publicRoutes = require("./routes/public");
const usersRouter = require("./routes/users");
const publicRegisterRoutes = require("./routes/publicRegister");
const { requireAuth, requireRole } = require("./routes/auth");

app.use("/api/auth", loginLimiter, authRoutes);
console.log("✓ Rutas /api/auth registradas");

app.use("/api/users", usersRouter);
console.log("✓ Rutas /api/users registradas");

app.use(
  "/api/docs",
  (req, res, next) => {
    console.log(`DEBUG DOCS >> ${req.method} ${req.originalUrl} llamado`);
    next();
  },
  docRoutes
);
console.log("✓ Rutas /api/docs registradas");

app.use(
  "/api/public",
  publicLimiter,
  (req, res, next) => {
    console.log(`DEBUG PUBLIC >> ${req.method} ${req.originalUrl} llamado`);
    next();
  },
  publicRoutes
);
console.log("✓ Rutas /api/public registradas");

app.use("/api/public", publicRegisterRoutes);
console.log("✓ Rutas /api/public/register registradas");

/* ================================
   RUTA S3 / URLs FIRMADAS
   ================================ */
app.get("/api/s3/download/:fileKey", requireAuth, async (req, res) => {
  try {
    const { getSignedUrl } = require("./services/s3");
    const db = require("./db");
    const fileKey = req.params.fileKey;

    const docCheck = await db.query(
      `SELECT id 
       FROM documents 
       WHERE file_path LIKE $1 AND owner_id = $2 
       LIMIT 1`,
      [`%${fileKey}%`, req.user.id]
    );

    if (docCheck.rows.length === 0) {
      return res.status(403).json({ message: "No tienes acceso a este archivo" });
    }

    const signedUrl = getSignedUrl(fileKey, 3600);
    res.json({ url: signedUrl, expires_in: 3600 });
  } catch (error) {
    console.error("❌ Error generando URL S3:", error);
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
   RECORDATORIOS
   ================================ */
app.post(
  "/api/recordatorios/pendientes",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { sendReminderEmail } = require("./services/sendReminderEmails");
      const db = require("./db");

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
    const db = require("./db");

    const docsResult = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'PENDIENTE_VISADO' OR status = 'PENDIENTE_FIRMA' THEN 1 ELSE 0 END) as pendientes,
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
Sentry.setupExpressErrorHandler(app); // v8
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
   INICIAR SCHEDULED TASKS
   ================================ */
const { iniciarReminderScheduler } = require("./jobs/reminderScheduler");
iniciarReminderScheduler();
console.log("✓ Scheduled tasks iniciados");

/* ================================
   INICIAR SERVIDOR
   ================================ */
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log("=====================================");
  console.log(`✅ API ESCUCHANDO EN PUERTO ${PORT}`);
  console.log("=====================================");
  console.log("📋 Rutas disponibles:");
  console.log("   GET  /api-docs (Documentación Swagger)");
  console.log("   GET  /api/health");
  console.log("   GET  /api/info");
  console.log("   GET  /api/sentry-test");
  console.log("   GET  /api/stats");
  console.log("   GET  /api/auth/...");
  console.log("   POST /api/auth/...");
  console.log("   GET  /api/users");
  console.log("   POST /api/users");
  console.log("   DELETE /api/users/:id");
  console.log("   GET  /api/docs");
  console.log("   POST /api/docs");
  console.log("   GET  /api/docs/:id/pdf");
  console.log("   GET  /api/docs/:id/timeline");
  console.log("   POST /api/docs/:id/firmar");
  console.log("   POST /api/docs/:id/visar");
  console.log("   POST /api/docs/:id/rechazar");
  console.log("   GET  /api/docs/:id/download");
  console.log("   GET  /api/docs/export/excel");
  console.log("   POST /api/docs/:id/recordatorio");
  console.log("   GET  /api/public/docs/:token");
  console.log("   POST /api/public/docs/:token/firmar");
  console.log("   POST /api/public/docs/:token/visar");
  console.log("   GET  /api/s3/download/:fileKey");
  console.log("   POST /api/recordatorios/pendientes");
  console.log("=====================================");
  console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL || "no configurada"}`);
  console.log(`☁️  S3 Bucket: ${process.env.AWS_S3_BUCKET || "no configurado"}`);
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
