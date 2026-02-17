// backend/instrument.js
const Sentry = require("@sentry/node");

// Inicializa Sentry lo más pronto posible
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
});

Sentry.setTag("env", process.env.NODE_ENV || "development");
Sentry.setTag("service", "verifirma-backend");
