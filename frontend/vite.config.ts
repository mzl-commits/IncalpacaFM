import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  cacheDir: ".vite/cache",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "SGTB Incalpaca",
        short_name: "SGTB",
        description: "Sistema de Gestión y Trazabilidad de Bienes",
        theme_color: "#071f38",
        background_color: "#f3f6fa",
        display: "standalone",
        start_url: "/",
        lang: "es",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("xlsx")) {
            return "vendor-xlsx";
          }
          if (id.includes("react") || id.includes("react-dom")) {
            return "vendor-react";
          }
        },
      },
    },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-shared",
              test: /[\\/]node_modules[\\/]/,
              minSize: 20_000,
              maxSize: 250_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    // Keep the development origin aligned with the public QR links.
    port: 8008,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
