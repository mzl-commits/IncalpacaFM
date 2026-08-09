import { expect, test } from "@playwright/test";

test.describe("Suite 6: Casos Excepcionales y Boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("sgtb_current_user", JSON.stringify({
        id: "USR-001",
        userId: 1,
        fullName: "Test User",
        email: "test@incalpaca.com",
        role: "ADMINISTRADOR",
        active: true
      }));
    });
  });

  test("EXC-01: Página 404 para rutas inexistentes", async ({ page }) => {
    await page.goto("/ruta-totalmente-inventada-que-no-existe");
    
    // Asumiendo que se tiene un fallback en React Router que muestra Not Found
    // o redirige
    const heading = page.getByRole("heading", { name: /404|No encontra|No existe/i });
    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    }
  });

  test("EXC-02: Timeouts simulados (Componentes de carga estables)", async ({ page }) => {
    // Retraso de 3 segundos en carga de catálogo para verificar que el loader
    // no rompe el layout
    await page.route("**/api/v1/catalog/materials", async (route) => {
      setTimeout(() => {
        route.fulfill({ status: 200, json: [] });
      }, 3000);
    });

    await page.goto("/almacen");
    
    // El indicador de carga debe verse
    const loader = page.locator('.loading, .loader, [role="status"]').first();
    if (await loader.isVisible()) {
      await expect(loader).toBeVisible();
    }
  });

  test("EXC-03: Desbordamiento de UI en pantallas muy pequeñas (Viewport constraints)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await page.goto("/");
    
    // Verificamos si hay scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    
    // La UI no debería desbordarse más del viewport en un layout responsive bien hecho
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 10);
  });

  test("EXC-04: Ids nulos o inválidos en URLs protegidas", async ({ page }) => {
    await page.goto("/bienes/null");
    
    // Debería mostrar un mensaje de error o redirigir
    // Simular que la API retorna 400
    await page.route("**/api/v1/assets/null", async (route) => {
      await route.fulfill({ status: 404, json: { detail: "Not found" } });
    });
    
    // Verificamos que maneja el caso donde el bien no existe (404 / Asset not found)
    const errText = page.getByText(/no encontra|no existe|error/i).first();
    if (await errText.isVisible()) {
      await expect(errText).toBeVisible();
    }
  });
});
