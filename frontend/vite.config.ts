import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "SGTB Incalpaca",
        short_name: "SGTB",
        description: "Sistema de Gestión y Trazabilidad de Bienes",
        theme_color: "#003366",
        background_color: "#f8f9ff",
        display: "standalone",
        start_url: "/",
        lang: "es",
      },
      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
