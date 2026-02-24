import * as Sentry from "@sentry/react";
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENV || "development",
  release: "verifirma-frontend@1.0.0", // nombre que tú quieras
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.3,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  debug: true,
});
