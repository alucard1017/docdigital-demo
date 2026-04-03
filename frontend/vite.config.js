// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

function manualChunks(id) {
  if (!id) return;

  const normalizedId = id.replace(/\\/g, "/");

  // 1) Agrupación por vistas internas (dominios funcionales)
  if (normalizedId.includes("/src/views/")) {
    if (
      normalizedId.includes("/src/views/UsersAdminView") ||
      normalizedId.includes("/src/views/CompaniesAdminView") ||
      normalizedId.includes("/src/views/StatusAdminView") ||
      normalizedId.includes("/src/views/AuditLogsView") ||
      normalizedId.includes("/src/views/AuthLogsView") ||
      normalizedId.includes("/src/views/RemindersConfigView")
    ) {
      return "admin";
    }

    if (
      normalizedId.includes("/src/views/DashboardView") ||
      normalizedId.includes("/src/views/CompanyAnalyticsView") ||
      normalizedId.includes("/src/views/EmailMetricsView")
    ) {
      return "analytics";
    }

    if (
      normalizedId.includes("/src/views/PublicSignView") ||
      normalizedId.includes("/src/views/VerificationView")
    ) {
      return "public";
    }

    if (
      normalizedId.includes("/src/views/TemplatesView") ||
      normalizedId.includes("/src/views/PricingView")
    ) {
      return "growth";
    }
  }

  // 2) Dependencias externas
  if (normalizedId.includes("/node_modules/")) {
    // React base en un chunk separado
    if (
      normalizedId.includes("/react/") ||
      normalizedId.includes("/react-dom/") ||
      normalizedId.includes("/scheduler/")
    ) {
      return "react-vendor";
    }

    // TODO: si algún día tienes un bloque PDF/editor gigante,
    // aquí puedes crear "pdf" o "editor" específicos.
    // Por ahora, todo lo demás va a vendor.
    return "vendor";
  }

  // 3) Resto: dejar que Vite/Rollup decidan
  return undefined;
}

export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze";

  return {
    plugins: [
      react(),
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: analyze,
      }),
    ],
    build: {
      sourcemap: analyze,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks,
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        },
      },
    },
  };
});