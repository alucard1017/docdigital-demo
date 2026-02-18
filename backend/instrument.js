// backend/instrument.js
require("dotenv").config();
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",

  // Ambiente visible en Sentry (prod / staging / local)
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",

  // Performance: ajusta este valor según tráfico
  tracesSampleRate: 0.3, // 30% de las requests; sube/baja aquí en el futuro
});

Sentry.setTag("env", process.env.NODE_ENV || "production");
Sentry.setTag("service", "verifirma-backend");
