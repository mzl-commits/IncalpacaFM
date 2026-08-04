import { expect, test } from "@playwright/test";

test("login is visible and fits the viewport", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Iniciar sesi.n/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("public QR renders the public asset and report action", async ({ page }) => {
  await page.route("**/api/v1/public/assets/demo-token/**", (route) => route.fulfill({ json: { display_code: "INC-001", fm_code: "INC-001", code: "internal", internal_code: "internal", name: "Activo de prueba", administrative_status: "ACTIVO", operational_status: "OPERATIVO", classification: "Equipo", brand: "Marca", model: "Modelo", general_location: "FM", condition: "Bueno", updated_at: "2026-08-04T00:00:00Z" } }));
  await page.goto("/q/demo-token");
  await expect(page.getByRole("heading", { name: "Activo de prueba" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reportar una incidencia/ })).toBeVisible();
});

test("public report shows its required fields", async ({ page }) => {
  await page.goto("/solicitud-trabajo");
  await expect(page.getByRole("heading", { name: /Solicita una orden|Solicitud/ })).toBeVisible();
  await expect(page.locator("textarea")).toBeVisible();
});

test("protected navigation sends anonymous users to login", async ({ page }) => {
  await page.goto("/bienes");
  await expect(page).toHaveURL(/\/login/);
});
