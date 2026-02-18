// o .js si tu proyecto no usa TS
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENV || "production",

  // Captura errores de UI + performance
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(), // opcional: session replay
  ],

  // Performance (frontend)
  tracesSampleRate: 0.3, // 30% de las navegaciones; ajusta según tráfico

  // Session Replay
  replaysSessionSampleRate: 0.0, // 0% usuarios sin errores
  replaysOnErrorSampleRate: 1.0, // 100% de sesiones con error
});
