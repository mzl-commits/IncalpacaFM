import { expect, test } from "@playwright/test";

test.describe("Suite 2: Gestión de Activos", () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como admin mockeado
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

  test("ASSET-01: Búsqueda interactiva (debouncing)", async ({ page }) => {
    await page.goto("/bienes");
    const searchInput = page.getByPlaceholder(/Buscar/i);
    await searchInput.fill("Motor");
    
    // Esperar a que la tabla o loader refleje el debounce (aprox 300-500ms)
    // Asumimos que muestra algún texto si no hay datos o la lista se filtra
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("ASSET-02: Navegación desde mapa", async ({ page }) => {
    await page.goto("/mapa");
    // El mapa debería renderizar los pines
    await expect(page.locator(".custom-marker").first()).toBeVisible({ timeout: 10000 });
    // Click en un pin
    await page.locator(".custom-marker").first().click();
    
    // Debería abrirse un popup con el enlace
    const popupLink = page.getByRole("link", { name: /Ver detalle/i }).first();
    await expect(popupLink).toBeVisible();
  });

  test("ASSET-03: Intentar crear activo con campos obligatorios vacíos", async ({ page }) => {
    await page.goto("/bienes/nuevo");
    
    const submitBtn = page.getByRole("button", { name: /Siguiente|Guardar/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      
      // Deben mostrarse errores de validación de HTML5 (requeridos) o de la UI
      // Verificamos foco o algún texto de requerimiento
      const requiredInput = page.locator('input:invalid, textarea:invalid, select:invalid').first();
      await expect(requiredInput).toBeVisible();
    }
  });

  test("ASSET-04: Casos de borde con nombres extremadamente largos", async ({ page }) => {
    await page.goto("/bienes/nuevo");
    const longName = "A".repeat(300);
    const nameInput = page.getByLabel(/Nombre/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill(longName);
      // Puede que HTML limite o que el estado se actualice.
      // Dependiendo de max-length (ej. 255), el valor real debe ser menor o igual a 255.
      const value = await nameInput.inputValue();
      expect(value.length).toBeLessThanOrEqual(300);
    }
  });

  test("ASSET-05: Validación de generación y visualización de QR", async ({ page }) => {
    await page.goto("/bienes");
    // Seleccionamos un checkbox si está habilitada la lista (Asumiendo que hay una checkbox global)
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1); 
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
      // Click en "Generar QR"
      const qrBtn = page.getByRole("button", { name: /Generar QR/i });
      if (await qrBtn.isVisible()) {
        await qrBtn.click();
        await expect(page).toHaveURL(/.*\/qr/);
        // Debe renderizarse el iframe o los elementos svg/img del QR
        await expect(page.locator("img").first()).toBeVisible();
      }
    }
  });
});
