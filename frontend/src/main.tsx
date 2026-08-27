import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/index.css";
import "./styles/executive.css";
import "./styles/qr-executive.css";
import "./styles/reports-executive.css";
import "./styles/typography.css";
import "./styles/surfaces.css";
import "./styles/filters.css";
import "./styles/taxonomy.css";
import "./styles/spaces.css";
import "./styles/facility-map.css";
import "./styles/location-maps.css";
import "./styles/asset-map-overview.css";
import "./styles/incident-create.css";
import "./styles/registries.css";
import "./styles/auth.css";
import "./styles/visual-refresh.css";
import "./styles/almacen.css";
import "./styles/theme-monochromatic.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
