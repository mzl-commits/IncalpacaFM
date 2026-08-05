import { expect, test } from "@playwright/test";

test.describe("QA Lifecycle - End to End", () => {
  // Configurar usuario administrador para las rutas protegidas
  test.beforeEach(async ({ page }) => {
    // Interceptar login y check de auth
    await page.route("**/api/v1/auth/session/", (route) =>
      route.fulfill({
        json: {
          user: { id: "u-1", email: "admin@test.com" },
          profile: { role: "ADMINISTRADOR", worker_code: "ADM-01", active: true },
        },
      })
    );
  });

  test("Flujo Completo Iterado: Creacion, Asignacion, Incidencia, OT, Reporte, Baja", async ({ page }) => {
    // 1. CREACIÓN DE BIEN
    await test.step("1. Creación de Bien", async () => {
      await page.route("**/api/v1/assets/", (route) => route.fulfill({ status: 201, json: { id: "asset-1", code: "A-001" } }));
      await page.route("**/api/v1/taxonomy/", (route) => route.fulfill({ json: { results: [{ id: "tax-1", name: "Silla" }] } }));
      
      await page.goto("/bienes/entradas/nueva");
      await expect(page.getByRole("heading", { name: /Nuevo Bien/i })).toBeVisible();
      // Simular llenado de formulario
      await page.locator("input[name='name']").fill("Silla Ergonómica QA");
      await page.locator("button[type='submit']").click();
      // Omitimos la validacion exacta de la redireccion dependiendo de la implementación
    });

    // 2. ASIGNACIÓN
    await test.step("2. Asignación del Bien", async () => {
      await page.route("**/api/v1/assignments/", (route) => route.fulfill({ status: 201, json: { id: "assign-1" } }));
      await page.route("**/api/v1/assets/available", (route) => route.fulfill({ json: [{ id: "asset-1", name: "Silla Ergonómica QA" }] }));
      
      await page.goto("/asignaciones/nueva");
      await expect(page.getByRole("heading", { name: /Asignar/i })).toBeVisible();
      await page.locator("button[type='submit']").click();
    });

    // 3. INCIDENCIA PÚBLICA (QR)
    await test.step("3. Reporte de Incidencia Pública", async () => {
      await page.route("**/api/v1/public/assets/demo-token/", (route) => route.fulfill({ json: { id: "asset-1", name: "Silla Ergonómica QA" } }));
      await page.route("**/api/v1/incidents/public/", (route) => route.fulfill({ status: 201, json: { id: "inc-1", code: "INC-QA" } }));
      
      await page.goto("/solicitud-trabajo?asset=demo-token");
      await expect(page.getByRole("heading", { name: /Solicitud/i })).toBeVisible();
      
      await page.locator("input[name='reporterName']").fill("QA Tester");
      await page.locator("input[name='reporterEmail']").fill("qa@test.com");
      await page.locator("input[name='reporterDni']").fill("12345678");
      await page.locator("input[name='reporterWorkerCode']").fill("QA-01");
      await page.locator("textarea[name='description']").fill("La silla está rota en una pata.");
      await page.locator("input[value='NO']").first().click(); // Impact options
      
      // Submit form
      await page.locator("button[type='submit']").click();
      await expect(page.getByText(/exitosamente|éxito/i)).toBeVisible();
    });

    // 4. CREACIÓN DE OT Y EJECUCIÓN (DIAGNÓSTICO)
    await test.step("4. Diagnóstico Técnico", async () => {
      await page.route("**/api/v1/work-orders/OT-001/", (route) => route.fulfill({ json: { id: "OT-001", status: "EN_PROGRESO" } }));
      await page.route("**/api/v1/lifecycle/diagnosis/", (route) => route.fulfill({ status: 201, json: { id: "diag-1", result: "IRREPARABLE" } }));
      
      await page.goto("/ordenes-trabajo/OT-001/diagnostico");
      await expect(page.getByRole("heading", { name: /Diagn.stico/i })).toBeVisible();
      
      await page.locator("textarea[name='description']").fill("Se revisó la silla y la base metálica está fisurada por completo.");
      await page.locator("select[name='result']").selectOption("IRREPARABLE");
      await page.locator("button[type='submit']").click();
    });

    // 5. BAJA DE ACTIVO
    await test.step("5. Solicitud de Baja", async () => {
      await page.route("**/api/v1/lifecycle/diagnosis/diag-1/", (route) => route.fulfill({ json: { id: "diag-1", asset: { name: "Silla Ergonómica QA" } } }));
      await page.route("**/api/v1/lifecycle/retirements/", (route) => route.fulfill({ status: 201, json: { id: "ret-1" } }));
      
      await page.goto("/bienes/ciclo-vida/bajas/nueva/diag-1");
      await expect(page.getByRole("heading", { name: /Baja/i })).toBeVisible();
      
      await page.locator("textarea[name='decisionReason']").fill("Por seguridad, el bien debe darse de baja.");
      await page.locator("button[type='submit']").click();
    });

    // 6. EMISIÓN DE REPORTE
    await test.step("6. Emisión de Reporte", async () => {
      await page.route("**/api/v1/reports/work-orders/", (route) => route.fulfill({ json: { results: [{ id: "OT-001", code: "OT-001" }] } }));
      await page.goto("/informes/ordenes-trabajo");
      await expect(page.getByRole("heading", { name: /Informe|Reporte/i })).toBeVisible();
      await expect(page.getByText("OT-001")).toBeVisible();
    });
  });
});
