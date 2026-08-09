import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "390", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "768", use: { viewport: { width: 768, height: 900 } } },
    { name: "1024", use: { viewport: { width: 1024, height: 900 } } },
    { name: "1440", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
