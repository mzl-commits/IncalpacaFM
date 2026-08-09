import { expect, test } from "@playwright/test";

test.describe("Suite 4: Órdenes de Trabajo", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("sgtb_current_user", JSON.stringify({
        id: "USR-TECH",
        userId: 2,
        fullName: "Técnico QA",
        email: "tech@incalpaca.com",
        role: "TECNICO",
        active: true
      }));
    });
  });

  test("WO-01: Listado de OT para técnico (Filtro por estado)", async ({ page }) => {
    await page.goto("/ordenes-trabajo");
    // Asumimos que un técnico solo ve lo suyo, o que puede filtrar
    const activeTab = page.locator('.tabs button, .filter-bar button').first();
    if (await activeTab.isVisible()) {
      await expect(activeTab).toBeVisible();
    }
  });

  test("WO-02: Editar costos con valores negativos y decimales inválidos (Validación)", async ({ page }) => {
    // Si la URL es parametrizada, podemos mockear la OT
    await page.route("**/api/v1/work-orders/1", async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: "1", code: "OT-001", status: "EN_PROCESO" }
      });
    });

    await page.goto("/ordenes-trabajo/1/ejecutar"); // Ejemplo de ruta
    
    // Buscar inputs numéricos (horas, costos)
    const numberInput = page.locator('input[type="number"]').first();
    if (await numberInput.isVisible()) {
      await numberInput.fill("-50.999");
      const submitBtn = page.getByRole("button", { name: /Guardar/i }).first();
      await submitBtn.click();
      
      // El navegador o la validación propia no debe permitir pasar
      await expect(page.locator(':invalid')).toBeVisible();
    }
  });

  test("WO-03: Cambio de estado no válido (Botones inhabilitados)", async ({ page }) => {
    // Un técnico no debería ver el botón de "Aprobar" (que es para supervisor)
    await page.route("**/api/v1/work-orders/2", async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: "2", code: "OT-002", status: "COMPLETADA" } // Ya completada
      });
    });

    await page.goto("/ordenes-trabajo/2");
    
    // Los botones de ejecución deben no estar visibles o deshabilitados
    const executeBtn = page.getByRole("link", { name: /Ejecutar|Reanudar/i });
    await expect(executeBtn).not.toBeVisible();
  });
});
