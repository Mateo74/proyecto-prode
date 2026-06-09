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
  "Arabia Saudita": "https://crests.test/ksa.png",
  "Uruguay": "https://crests.test/uru.png",
};

const TEAM_IDS = {
  "España": "cmpkkdywt0010g8odkh64xc0w",
  "Cabo Verde": "cmpkkdyx30011g8odivqlsvj4",
  "Arabia Saudita": "cmpkkdyyt0016g8odoxtqwnkk",
  "Uruguay": "cmoxxz2qz000wag5qd4b9u7v5",
};

// Three finished Group H results.
// España 2-0 Cabo Verde, España 1-1 Arabia Saudita, Cabo Verde 0-3 Uruguay.
// Resulting standings: España 4 (PJ2), Uruguay 3 (PJ1), Arabia Saudita 1 (PJ1), Cabo Verde 0 (PJ2).
function finishedGroupHResults() {
  const mk = (id, e1, e2, s1, s2) => ({
    id,
    competenciaId: "comp-wc",
    liga: "Copa Mundial FIFA",
    equipo1Id: TEAM_IDS[e1],
    equipo1: e1,
    equipo2Id: TEAM_IDS[e2],
    equipo2: e2,
    equipo1EscudoUrl: CREST[e1],
    equipo2EscudoUrl: CREST[e2],
    estado: "finalizado",
    scoreEquipo1: s1,
    scoreEquipo2: s2,
    resultadoConfirmado: true,
    fecha: "2026-06-15T18:00:00.000Z",
    prediccionEditable: false,
    userPred: null,
  });
  return [
    mk("wc-H-1", "España", "Cabo Verde", 2, 0),
    mk("wc-H-3", "España", "Arabia Saudita", 1, 1),
    mk("wc-H-4", "Cabo Verde", "Uruguay", 0, 3),
  ];
}

async function setup(page, { finished = [], live = [] } = {}) {
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
      const estado = url.searchParams.get("estado");
      if (estado === "finalizado") return json(route, finished);
      if (estado === "en-vivo") return json(route, live);
      return json(route, []);
    }
    await json(route, { message: "Unhandled API route" }, 404);
  });

  await page.goto("/pages/partidos.html");
}

const standings = (page) => page.locator("#standings-view");
const standingsGroupH = (page) => standings(page).locator(".group-table", { hasText: "Grupo H" });

async function openStandings(page, filterValue) {
  await page.locator(`.filter-chip[data-value="${filterValue}"]`).click();
  // The Matches/Standings toggle becomes available under live/finished filters.
  await expect(page.locator("#standings-toggle")).toBeVisible();
  await page.locator('[data-results-view="standings"]').click();
  await expect(standings(page)).toBeVisible();
}

test("finished results populate the real group standings", async ({ page }) => {
  await setup(page, { finished: finishedGroupHResults() });

  await openStandings(page, "finalizado");

  // The standings header badge is shown.
  await expect(standings(page).locator(".standings-view__head .badge")).toHaveText("Posiciones de grupos");

  // All 12 official groups render.
  await expect(standings(page).locator(".group-table")).toHaveCount(12);

  const groupH = standingsGroupH(page);
  await expect(groupH).toBeVisible();

  // Teams ordered by actual points: España 4, Uruguay 3, Arabia Saudita 1, Cabo Verde 0.
  await expect(groupH.locator(".group-table__name")).toHaveText([
    "España",
    "Uruguay",
    "Arabia Saudita",
    "Cabo Verde",
  ]);

  // Points column reflects the 3 finished results.
  await expect(groupH.locator("tbody tr .group-table__pts")).toHaveText(["4", "3", "1", "0"]);

  // España row: PJ 2, GF 3, GC 1.
  const espanaCells = groupH.locator("tbody tr", { hasText: "España" }).locator("td");
  await expect(espanaCells.nth(1)).toHaveText("2"); // PJ
  await expect(espanaCells.nth(2)).toHaveText("3"); // GF
  await expect(espanaCells.nth(3)).toHaveText("1"); // GC
});

test("live filter shows the group standings table even when empty", async ({ page }) => {
  await setup(page, { live: [] });

  await openStandings(page, "en-vivo");

  // Table still renders all 12 groups with zeroed rows.
  await expect(standings(page).locator(".group-table")).toHaveCount(12);
  await expect(standingsGroupH(page)).toBeVisible();
  await expect(standingsGroupH(page).locator("tbody tr .group-table__pts")).toHaveText(["0", "0", "0", "0"]);

  // No team has completed games, so no row is marked complete.
  await expect(standingsGroupH(page).locator("tbody tr.is-complete")).toHaveCount(0);
});

test("switching back to matches keeps the finished match cards", async ({ page }) => {
  await setup(page, { finished: finishedGroupHResults() });

  await openStandings(page, "finalizado");
  await expect(page.locator("#matches-list")).toBeHidden();

  await page.locator('[data-results-view="matches"]').click();
  await expect(page.locator("#matches-list")).toBeVisible();
  await expect(page.locator('.match-card[data-match-id="wc-H-1"]')).toBeVisible();
  await expect(standings(page)).toBeHidden();
});
