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

const TEAM_IDS = {
  "España": "cmpkkdywt0010g8odkh64xc0w",
  "Cabo Verde": "cmpkkdyx30011g8odivqlsvj4",
  "Arabia Saudita": "cmpkkdyyt0016g8odoxtqwnkk",
  "Uruguay": "cmoxxz2qz000wag5qd4b9u7v5",
};

// Full round-robin for Group H with predictions, so the standings are deterministic.
// Predicted points: Arabia Saudita 5, Cabo Verde 4 (GD 0), Uruguay 4 (GD -1), España 3.
function groupHMatches() {
  const crest = {
    "España": "https://crests.test/esp.png",
    "Cabo Verde": "https://crests.test/cpv.png",
    "Arabia Saudita": "https://crests.test/ksa.png",
    "Uruguay": "https://crests.test/uru.png",
  };
  const mk = (id, e1, e2, s1, s2) => ({
    id,
    competenciaId: "comp-wc",
    liga: "Copa Mundial FIFA",
    equipo1Id: TEAM_IDS[e1],
    equipo1: e1,
    equipo2Id: TEAM_IDS[e2],
    equipo2: e2,
    equipo1EscudoUrl: crest[e1],
    equipo2EscudoUrl: crest[e2],
    estado: "proximo",
    fecha: "2026-06-15T18:00:00.000Z",
    prediccionEditable: true,
    userPred: { id: `p-${id}`, scoreEquipo1: s1, scoreEquipo2: s2, estado: "pendiente", puntos: 0 },
  });
  return [
    mk("wc-H-1", "España", "Cabo Verde", 2, 0),
    mk("wc-H-2", "Arabia Saudita", "Uruguay", 1, 1),
    mk("wc-H-3", "España", "Arabia Saudita", 0, 1),
    mk("wc-H-4", "Cabo Verde", "Uruguay", 3, 1),
    mk("wc-H-5", "España", "Uruguay", 1, 2),
    mk("wc-H-6", "Cabo Verde", "Arabia Saudita", 2, 2),
  ];
}

async function mockApi(page, matches, lang = "es") {
  await page.addInitScript((l) => {
    localStorage.setItem("once_metros_lang", l);
  }, lang);
  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (url.pathname === "/api/auth/refresh") {
      await json(route, { token: "access-token", usuario: { id: "user-1", username: "demo", nombre: "Demo", idioma: lang } });
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
    await json(route, { message: "Unhandled API route" }, 404);
  });
}

test("renders predicted World Cup group standings from user predictions", async ({ page }) => {
  await mockApi(page, groupHMatches());

  await page.goto("/pages/grupos.html");

  // The group H table renders with its title.
  const groupH = page.locator(".group-table", { hasText: "Grupo H" });
  await expect(groupH).toBeVisible();

  // Teams are sorted by predicted points (desc), then goal difference.
  const names = groupH.locator(".group-table__name");
  await expect(names).toHaveText(["Arabia Saudita", "Cabo Verde", "Uruguay", "España"]);

  // Points column for the leader (Arabia Saudita) is 5.
  const leaderRow = groupH.locator("tbody tr").first();
  await expect(leaderRow.locator(".group-table__pts")).toHaveText("5");

  // Every team has all 3 group games predicted -> orange "is-complete" accent.
  await expect(groupH.locator("tbody tr.is-complete")).toHaveCount(4);

  // Crest URLs from the matches are piped through as <img> flags.
  await expect(groupH.locator('.group-table__crest img[src*="ksa.png"]')).toBeVisible();

  // All 12 official groups render (A–L).
  await expect(page.locator(".group-table")).toHaveCount(12);
});

test("localizes group labels and team names to English", async ({ page }) => {
  await mockApi(page, groupHMatches(), "en");

  await page.goto("/pages/grupos.html");

  // Structural labels are translated (Grupo -> Group).
  const groupH = page.locator(".group-table", { hasText: "Group H" });
  await expect(groupH).toBeVisible();
  const headerCells = groupH.locator("thead tr").nth(1).locator("th");
  await expect(headerCells.nth(0)).toHaveText("Team");
  await expect(headerCells.nth(1)).toHaveText("MP");
  await expect(headerCells.nth(3)).toHaveText("GA");

  // Team names are translated to English while keeping the predicted order.
  const names = groupH.locator(".group-table__name");
  await expect(names).toHaveText(["Saudi Arabia", "Cape Verde", "Uruguay", "Spain"]);
});
