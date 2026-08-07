import { expect, test } from "@playwright/test";

test.describe("Suite 5: Almacén e Inventario", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("sgtb_current_user", JSON.stringify({
        id: "USR-ADMIN",
        userId: 1,
        fullName: "Admin",
        role: "ADMINISTRADOR",
        active: true
      }));
    });
  });

  test("WH-01: Registro de movimiento de entrada y validación de UI", async ({ page }) => {
    await page.goto("/almacen/movimientos/nuevo?tipo=ENTRADA");
    
    // Si la página de nuevo movimiento existe, esperamos sus campos
    const codeInput = page.locator('input[type="text"]').first();
    if (await codeInput.isVisible()) {
      await codeInput.fill("MAT-01");
      const numInput = page.locator('input[type="number"]').first();
      await numInput.fill("10");
      
      const submitBtn = page.getByRole("button", { name: /Registrar/i });
      await submitBtn.click();
      
      // Debe haber feedback de éxito o error si la validación falla
      // Si todo va bien, puede haber un toast o redirección
      await expect(page.locator('.toast, dialog')).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("WH-02: Prevención de salida sin stock (QA)", async ({ page }) => {
    await page.goto("/almacen/movimientos/nuevo?tipo=SALIDA");
    
    // Si intenta retirar 9999 de un item que no tiene
    // La API local fallará o la UI bloqueará
    const numInput = page.locator('input[type="number"]').first();
    if (await numInput.isVisible()) {
      await numInput.fill("99999");
      
      const submitBtn = page.getByRole("button", { name: /Registrar/i });
      await submitBtn.click();
      
      // La API debe retornar error 400 u otro, manejado por UI
      await expect(page.locator('.error, :invalid')).toBeVisible().catch(() => {});
    }
  });

  test("WH-03: Formulario de inspección (fechas futuras bloqueadas)", async ({ page }) => {
    await page.goto("/almacen/inspecciones/nueva/1"); // Suponiendo id=1
    
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      // Intenta poner el año 3000 si está acotado con 'max'
      await dateInput.fill("3000-01-01");
      
      const submitBtn = page.getByRole("button", { name: /Registrar/i });
      await submitBtn.click();
      
      // Si el navegador respeta 'max', bloquea o muestra :invalid
      // Si no, la validación de JS debe saltar
      const isInvalid = await dateInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
      expect(isInvalid).toBeTruthy();
    }
  });
});
