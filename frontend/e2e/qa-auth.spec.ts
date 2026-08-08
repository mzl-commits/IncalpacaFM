import { expect, test } from "@playwright/test";

test.describe("Suite 1: Autenticación y Autorización", () => {
  // Configuración de limpieza antes de cada test para asegurar estado aislado
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
  });

  test("AUTH-01: Login exitoso con credenciales correctas", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@incalpaca.com");
    await page.fill('input[type="password"]', "admin123");
    
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "USR-001",
            userId: 1,
            fullName: "Administrador Prueba",
            email: "admin@incalpaca.com",
            role: "ADMINISTRADOR",
            active: true
          },
          token: "fake-jwt-token"
        }
      });
    });

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
  });

  test("AUTH-02: Login fallido con credenciales incorrectas", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@incalpaca.com");
    await page.fill('input[type="password"]', "wrongpassword");
    
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        json: { detail: "Credenciales inválidas" }
      });
    });

    await page.click('button[type="submit"]');
    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("AUTH-03: Redirección de ruta protegida sin sesión", async ({ page }) => {
    await page.goto("/bienes");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("AUTH-04: Cierre de sesión y limpieza de estado", async ({ page }) => {
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
    
    await page.goto("/");
    // Open user menu
    await page.click('.sidebar-user'); 
    
    // Click logout
    const logoutBtn = page.getByRole('button', { name: /Cerrar sesión/i });
    await logoutBtn.click();
    
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("AUTH-05: Intento repetido de login (Protección básica)", async ({ page }) => {
    await page.goto("/login");
    await page.route("**/api/v1/auth/login", async (route) => {
      setTimeout(() => route.fulfill({ status: 401, json: { detail: "Error" } }), 500);
    });

    await page.fill('input[type="email"]', "spam@incalpaca.com");
    await page.fill('input[type="password"]', "spam");
    
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();
    await expect(page.getByText(/Error/i)).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });
});
