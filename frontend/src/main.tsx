import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "@/app/App";
import "@/styles/index.css";
import "@/styles/executive.css";
import "@/styles/qr-executive.css";
import "@/styles/reports-executive.css";
import "@/styles/typography.css";
import "@/styles/surfaces.css";
import "@/styles/filters.css";
import "@/styles/taxonomy.css";
import "@/styles/facility-map.css";
import "@/styles/location-maps.css";
import "@/styles/asset-map-overview.css";
import "@/styles/incident-create.css";
import "@/styles/registries.css";
import "@/styles/auth.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
