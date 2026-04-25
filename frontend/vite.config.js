// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

function normalizeId(id = "") {
  return String(id).replace(/\\/g, "/");
}

function isNodeModule(id) {
  return id.includes("/node_modules/");
}

function includesAny(id, patterns = []) {
  return patterns.some((pattern) => id.includes(pattern));
}

const VIEW_GROUPS = {
  admin: [
    "/src/views/UsersAdminView",
    "/src/views/CompaniesAdminView",
    "/src/views/StatusAdminView",
    "/src/views/AuditLogsView",
    "/src/views/AuthLogsView",
    "/src/views/RemindersConfigView",
  ],
  analytics: [
    "/src/views/DashboardView",
    "/src/views/CompanyAnalyticsView",
    "/src/views/EmailMetricsView",
  ],
  public: [
    "/src/views/PublicSignView",
    "/src/views/VerificationView",
  ],
  growth: [
    "/src/views/TemplatesView",
    "/src/views/PricingView",
  ],
};

const VENDOR_GROUPS = {
  react: ["/react/", "/react-dom/", "/scheduler/"],
  router: ["/react-router/", "/react-router-dom/", "/@remix-run/"],
};

function resolveViewChunk(normalizedId) {
  if (!normalizedId.includes("/src/views/")) return undefined;

  for (const [chunkName, patterns] of Object.entries(VIEW_GROUPS)) {
    if (includesAny(normalizedId, patterns)) {
      return chunkName;
    }
  }

  return undefined;
}

function resolveVendorChunk(normalizedId) {
  if (!isNodeModule(normalizedId)) return undefined;

  if (includesAny(normalizedId, VENDOR_GROUPS.react)) {
    return "react-vendor";
  }

  if (includesAny(normalizedId, VENDOR_GROUPS.router)) {
    return "router-vendor";
  }

  return "vendor";
}

function manualChunks(id) {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return undefined;

  const viewChunk = resolveViewChunk(normalizedId);
  if (viewChunk) return viewChunk;

  const vendorChunk = resolveVendorChunk(normalizedId);
  if (vendorChunk) return vendorChunk;

  return undefined;
}

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === "analyze";

  return {
    plugins: [
      react(),
      ...(isAnalyze
        ? [
            visualizer({
              filename: "dist/stats.html",
              template: "treemap",
              gzipSize: true,
              brotliSize: true,
              open: true,
            }),
          ]
        : []),
    ],

    // Config de Vitest
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setupTests.js",
    },

    build: {
      sourcemap: isAnalyze,
      chunkSizeWarningLimit: 900,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks,
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: ({ name }) => {
            const normalizedName = normalizeId(name || "");

            if (/\.(css)$/i.test(normalizedName)) {
              return "assets/css/[name]-[hash][extname]";
            }

            if (/\.(png|jpe?g|svg|gif|webp|avif)$/i.test(normalizedName)) {
              return "assets/img/[name]-[hash][extname]";
            }

            if (/\.(woff2?|ttf|otf|eot)$/i.test(normalizedName)) {
              return "assets/fonts/[name]-[hash][extname]";
            }

            return "assets/[ext]/[name]-[hash][extname]";
          },
        },
      },
    },
  };
});