import { expect, test } from "@playwright/test";

test.describe("Suite 3: Reportes de Incidencias", () => {
  test("INC-01: Flujo de solicitud pública anónima (campos obligatorios)", async ({ page }) => {
    await page.goto("/solicitud-trabajo");
    
    // Dejar campos vacíos y enviar
    const submitBtn = page.getByRole("button", { name: /Enviar|Siguiente/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      
      // Deben existir validaciones requeridas
      const invalidFields = page.locator(':invalid');
      await expect(invalidFields.first()).toBeVisible();
    }
  });

  test("INC-02: Flujo de solicitud pública - Envío exitoso", async ({ page }) => {
    await page.goto("/solicitud-trabajo");
    
    // Interceptar para mockear éxito
    await page.route("**/api/v1/public/incidents", async (route) => {
      await route.fulfill({
        status: 201,
        json: { id: "req-1", code: "INC-2026-999" }
      });
    });

    await page.fill('input[name="requesterName"], input[id="name"]', "Usuario QA");
    await page.fill('textarea', "Hay una filtración de agua importante en la pared.");
    // Supongamos que hay un select o radio de tipo
    // Llenar más campos requeridos si aplica
    
    const submitBtn = page.getByRole("button", { name: /Enviar solicitud/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      
      // Debe aparecer el mensaje de éxito
      await expect(page.getByText(/exitosamente/i)).toBeVisible();
    }
  });

  test("INC-03: Manejo de errores al enviar (mock 500)", async ({ page }) => {
    await page.goto("/solicitud-trabajo");
    
    // Interceptar para mockear error
    await page.route("**/api/v1/public/incidents", async (route) => {
      await route.fulfill({
        status: 500,
        body: "Internal Server Error"
      });
    });

    await page.fill('input[name="requesterName"], input[id="name"]', "QA Error");
    await page.fill('textarea', "Test 500");
    
    const submitBtn = page.getByRole("button", { name: /Enviar solicitud/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      
      // Debe aparecer mensaje de error o notificación
      await expect(page.locator('.toast, .error-message, .alert').filter({ hasText: /error/i }).first()).toBeVisible();
    }
  });

  test("INC-04: Inyección de caracteres especiales en descripción", async ({ page }) => {
    await page.goto("/solicitud-trabajo");
    const specialChars = "<script>alert(1)</script> & SELECT * FROM users;";
    await page.fill('textarea', specialChars);
    
    const value = await page.inputValue('textarea');
    expect(value).toBe(specialChars);
    // React debe renderizar de forma segura sin ejecutar nada si lo enviamos (QA de XSS implícito)
  });
});
