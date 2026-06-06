const { test, expect } = require("@playwright/test");

const corsHeaders = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-origin": "http://127.0.0.1:4173",
};

async function json(route, body, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: corsHeaders, body: JSON.stringify(body) });
}

const CREST = {
  "España": "https://crests.test/esp.png",
  "Cabo Verde": "https://crests.test/cpv.png",
  "Arabia Saudí": "https://crests.test/ksa.png",
  "Uruguay": "https://crests.test/uru.png",
};

// Group H round-robin. `predictH6` toggles whether the 6th match starts predicted.
function groupHMatches({ predictH6 = true } = {}) {
  const mk = (id, e1, e2, s1, s2) => ({
    id,
    competenciaId: "comp-wc",
    liga: "Copa Mundial FIFA",
    equipo1: e1,
    equipo2: e2,
    equipo1EscudoUrl: CREST[e1],
    equipo2EscudoUrl: CREST[e2],
    estado: "proximo",
    fecha: "2026-06-15T18:00:00.000Z",
    prediccionEditable: true,
    userPred: s1 == null ? null : { id: `p-${id}`, scoreEquipo1: s1, scoreEquipo2: s2, estado: "pendiente", puntos: 0 },
  });
  return [
    mk("wc-H-1", "España", "Cabo Verde", 2, 0),
    mk("wc-H-2", "Arabia Saudí", "Uruguay", 1, 1),
    mk("wc-H-3", "España", "Arabia Saudí", 0, 1),
    mk("wc-H-4", "Cabo Verde", "Uruguay", 3, 1),
    mk("wc-H-5", "España", "Uruguay", 1, 2),
    predictH6
      ? mk("wc-H-6", "Cabo Verde", "Arabia Saudí", 2, 2)
      : mk("wc-H-6", "Cabo Verde", "Arabia Saudí", null, null),
  ];
}

async function setup(page, matches) {
  await page.addInitScript(() => {
    localStorage.setItem("once_metros_lang", "es");
    localStorage.setItem(
      "once_metros_selected_competencia",
      JSON.stringify({ id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" }),
    );
  });
  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (url.pathname === "/api/auth/refresh") {
      await json(route, { token: "access-token", usuario: { id: "user-1", username: "demo", nombre: "Demo", idioma: "es" } });
      return;
    }
    if (url.pathname === "/api/competencias") {
      await json(route, [{ id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" }]);
      return;
    }
    if (url.pathname === "/api/partidos") {
      await json(route, matches);
      return;
    }
    if (url.pathname === "/api/predicciones") {
      await json(route, { id: "saved", scoreEquipo1: 0, scoreEquipo2: 0 });
      return;
    }
    await json(route, { message: "Unhandled API route" }, 404);
  });

  await page.goto("/pages/partidos.html");
  await expect(page.locator('.match-card[data-match-id="wc-H-1"]')).toBeVisible();
}

const overlay = (page) => page.locator("#grupos-overlay");
const overlayGroupH = (page) => page.locator("#grupos-overlay-body .group-table", { hasText: "Grupo H" });

async function openOverlay(page) {
  await page.locator("#grupos-fab").click();
  await expect(overlay(page)).toHaveClass(/grupos-overlay--visible/);
  await expect(overlayGroupH(page)).toBeVisible();
}

async function closeOverlay(page) {
  await page.locator(".grupos-overlay__close").click();
  await expect(overlay(page)).not.toHaveClass(/grupos-overlay--visible/);
}

function box(page, matchId, side) {
  return page.locator(`.match-card[data-match-id="${matchId}"] .score-box[data-side="${side}"]`);
}

test("erasing all predictions empties the predicted groups", async ({ page }) => {
  await setup(page, groupHMatches());

  // Initially populated: Arabia Saudí leads Group H with 5 predicted points.
  await openOverlay(page);
  await expect(overlayGroupH(page).locator(".group-table__name").first()).toHaveText("Arabia Saudí");
  await expect(overlayGroupH(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("5");
  await expect(overlayGroupH(page).locator("tbody tr.is-complete")).toHaveCount(4);
  await closeOverlay(page);

  // Erase every score box on the page.
  for (const id of ["wc-H-1", "wc-H-2", "wc-H-3", "wc-H-4", "wc-H-5", "wc-H-6"]) {
    await box(page, id, "equipo1").fill("");
    await box(page, id, "equipo2").fill("");
  }

  // Re-open: every team now has zero points and no group is complete.
  await openOverlay(page);
  const pts = overlayGroupH(page).locator(".group-table__pts");
  await expect(pts).toHaveText(["0", "0", "0", "0"]);
  await expect(overlayGroupH(page).locator("tbody tr.is-complete")).toHaveCount(0);
});

test("updating an existing prediction updates the predicted groups", async ({ page }) => {
  await setup(page, groupHMatches());

  await openOverlay(page);
  await expect(overlayGroupH(page).locator(".group-table__name").first()).toHaveText("Arabia Saudí");
  await closeOverlay(page);

  // Flip España 0-1 Arabia Saudí (KSA win) into España 3-0 (España win).
  await box(page, "wc-H-3", "equipo1").fill("3");
  await box(page, "wc-H-3", "equipo2").fill("0");

  // Re-open: España now leads the group with 6 points.
  await openOverlay(page);
  await expect(overlayGroupH(page).locator(".group-table__name").first()).toHaveText("España");
  await expect(overlayGroupH(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("6");
});

test("adding a new prediction is reflected in the predicted groups", async ({ page }) => {
  await setup(page, groupHMatches({ predictH6: false }));

  // wc-H-6 unpredicted: only España and Uruguay have played all 3 games.
  await openOverlay(page);
  await expect(overlayGroupH(page).locator("tbody tr.is-complete")).toHaveCount(2);
  await closeOverlay(page);

  // Add the missing prediction: Cabo Verde 2-2 Arabia Saudí.
  await box(page, "wc-H-6", "equipo1").fill("2");
  await box(page, "wc-H-6", "equipo2").fill("2");

  // Re-open: all four teams now have 3 games predicted and Arabia Saudí reaches 5 pts.
  await openOverlay(page);
  await expect(overlayGroupH(page).locator("tbody tr.is-complete")).toHaveCount(4);
  await expect(overlayGroupH(page).locator(".group-table__name").first()).toHaveText("Arabia Saudí");
  await expect(overlayGroupH(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("5");
});
