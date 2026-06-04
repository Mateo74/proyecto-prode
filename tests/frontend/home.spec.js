const { test, expect } = require("@playwright/test");

const corsHeaders = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-origin": "http://127.0.0.1:4173",
};

async function json(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

test("loads tournaments for the selected competition through the backend filter", async ({ page }) => {
  const apiRequests = [];

  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    apiRequests.push({ method: request.method(), url });

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      await json(route, {
        token: "access-token",
        usuario: { id: "user-1", username: "mateo", nombre: "Mateo", idioma: "es" },
      });
      return;
    }

    if (url.pathname === "/api/competencias") {
      await json(route, [
        { id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" },
      ]);
      return;
    }

    if (url.pathname === "/api/partidos") {
      await json(route, []);
      return;
    }

    if (url.pathname === "/api/torneos") {
      await json(route, [
        {
          id: "torneo-global",
          nombre: "Global",
          esGlobal: true,
          activo: true,
          competenciaId: "comp-wc",
          competencia: { id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" },
          creadorId: null,
          creador: null,
          miembrosCount: 0,
          fechaCreacion: "2026-06-01T00:00:00.000Z",
        },
      ]);
      return;
    }

    await json(route, { message: "Unhandled API route" }, 404);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Copa Mundial FIFA" }).click();
  await page.getByRole("button", { name: "Torneos de Amigos" }).click();

  await expect(page.getByRole("button", { name: "Once Metros - Copa Mundial FIFA" })).toBeVisible();

  const torneosRequest = apiRequests.find((entry) => entry.url.pathname === "/api/torneos");
  expect(torneosRequest).toBeTruthy();
  expect(torneosRequest.url.searchParams.get("mias")).toBe("true");
  expect(torneosRequest.url.searchParams.get("competenciaId")).toBe("comp-wc");
});
