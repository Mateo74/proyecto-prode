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

// Real Equipo ids from js/world-cup-2026.js for groups A and B.
const TEAM_IDS = {
  // Group A
  "México": "cmpkkdyir0000g8odvn98frju",
  "Sudáfrica": "cmpkkdyj10001g8odhex51qvd",
  "Corea del Sur": "cmpkkdykg0003g8od358yryx6",
  "Chequia": "cmpkkdyko0004g8odkwz3rh8t",
  // Group B
  "Canadá": "cmpkkdylb0006g8oddpqkb65m",
  "Suiza": "cmpkkdyol000dg8odjs7mbyh4",
  "Qatar": "cmpkkdyo1000cg8odqcvoomni",
  "Bosnia-H.": "cmpkkdyli0007g8odm7sbuz9b",
};

function mk(id, e1, e2, extra = {}) {
  return {
    id,
    competenciaId: "comp-wc",
    liga: "Copa Mundial FIFA",
    equipo1Id: TEAM_IDS[e1],
    equipo1: e1,
    equipo2Id: TEAM_IDS[e2],
    equipo2: e2,
    estado: "proximo",
    fecha: "2026-06-15T18:00:00.000Z",
    prediccionEditable: true,
    userPred: null,
    ...extra,
  };
}

// Group B round-robin, all upcoming and unpredicted (filled in by the test).
function groupBMatches() {
  return [
    mk("wc-B-1", "Canadá", "Suiza"),
    mk("wc-B-2", "Qatar", "Bosnia-H."),
    mk("wc-B-3", "Canadá", "Qatar"),
    mk("wc-B-4", "Suiza", "Bosnia-H."),
    mk("wc-B-5", "Canadá", "Bosnia-H."),
    mk("wc-B-6", "Suiza", "Qatar"),
  ];
}

// Group A round-robin, all upcoming and unpredicted.
function groupAMatches() {
  return [
    mk("wc-A-1", "México", "Sudáfrica"),
    mk("wc-A-2", "Corea del Sur", "Chequia"),
    mk("wc-A-3", "México", "Corea del Sur"),
    mk("wc-A-4", "Sudáfrica", "Chequia"),
    mk("wc-A-5", "México", "Chequia"),
    mk("wc-A-6", "Sudáfrica", "Corea del Sur"),
  ];
}

// Drives the real in-app flow: home workspace (index.html) -> select the World
// Cup competition -> the "Grupos" tab (default for the World Cup) shows the
// per-group carousel + standings + that group's match cards.
async function setup(page, matches, lang = "es") {
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
    if (url.pathname === "/api/torneos") {
      await json(route, []);
      return;
    }
    if (url.pathname === "/api/predicciones") {
      await json(route, { id: "saved", scoreEquipo1: 0, scoreEquipo2: 0 });
      return;
    }
    await json(route, { message: "Unhandled API route" }, 404);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Copa Mundial FIFA" }).click();
  // Selecting the World Cup lands on the Grupos tab; wait for the carousel header.
  await expect(carouselLabel(page)).toHaveText("Grupo A");
}

const standings = (page) => page.locator("#group-standings .group-table");
const carouselLabel = (page) => page.locator("#group-carousel-label");

function box(page, matchId, side) {
  return page.locator(`#group-matches .match-card[data-match-id="${matchId}"] .score-box[data-side="${side}"]`);
}

async function setScore(page, matchId, s1, s2) {
  await box(page, matchId, "equipo1").fill(String(s1));
  await box(page, matchId, "equipo2").fill(String(s2));
}

test("groups view: carousel to group B, predict every match, table updates", async ({ page }) => {
  await setup(page, groupBMatches());

  // Group A has no matches in this fixture; one carousel step lands on Group B.
  await page.locator(".group-carousel__next").click();
  await expect(carouselLabel(page)).toHaveText("Grupo B");
  await expect(page.locator('#group-matches .match-card[data-match-id="wc-B-1"]')).toBeVisible();

  // Predict the whole group. Suiza wins all three -> 9 pts and clear leader.
  await setScore(page, "wc-B-1", 0, 2); // Canadá 0-2 Suiza
  await setScore(page, "wc-B-2", 1, 1); // Qatar 1-1 Bosnia-H.
  await setScore(page, "wc-B-3", 1, 0); // Canadá 1-0 Qatar
  await setScore(page, "wc-B-4", 3, 0); // Suiza 3-0 Bosnia-H.
  await setScore(page, "wc-B-5", 2, 2); // Canadá 2-2 Bosnia-H.
  await setScore(page, "wc-B-6", 1, 0); // Suiza 1-0 Qatar

  // The live standings reflect every prediction.
  await expect(standings(page).locator(".group-table__name")).toHaveText([
    "Suiza", "Canadá", "Bosnia-H.", "Qatar",
  ]);
  await expect(standings(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("9");
  await expect(standings(page).locator("tbody tr.is-complete")).toHaveCount(4);
});

test("groups view: a group A prediction survives a full carousel loop back to A", async ({ page }) => {
  await setup(page, groupAMatches());

  // Predict a single Group A match: México 2-0 Sudáfrica -> México leads with 3.
  await setScore(page, "wc-A-1", 2, 0);
  await expect(standings(page).locator(".group-table__name").first()).toHaveText("México");
  await expect(standings(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("3");

  // Cycle through every group (A -> B -> ... -> L -> A): 12 next clicks wrap to A.
  for (let i = 0; i < 12; i++) {
    await page.locator(".group-carousel__next").click();
  }
  await expect(carouselLabel(page)).toHaveText("Grupo A");

  // The prediction and the predicted standings are still there.
  await expect(box(page, "wc-A-1", "equipo1")).toHaveValue("2");
  await expect(box(page, "wc-A-1", "equipo2")).toHaveValue("0");
  await expect(standings(page).locator(".group-table__name").first()).toHaveText("México");
  await expect(standings(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("3");

  // Regression: untouched matches must render EMPTY inputs after re-render, never
  // the literal string "null" (which leaked from enriched {scoreEquipo1: null}).
  await expect(box(page, "wc-A-2", "equipo1")).toHaveValue("");
  await expect(box(page, "wc-A-2", "equipo2")).toHaveValue("");
});

test("groups view: finished matches are read-only and show their score", async ({ page }) => {
  const matches = [
    mk("wc-A-1", "México", "Sudáfrica", {
      estado: "finalizado",
      prediccionEditable: false,
      scoreEquipo1: 2,
      scoreEquipo2: 1,
      resultadoConfirmado: true,
      userPred: { id: "p-A-1", scoreEquipo1: 1, scoreEquipo2: 1, estado: "fallo", puntos: 0 },
    }),
    mk("wc-A-2", "Corea del Sur", "Chequia"),
  ];
  await setup(page, matches);

  const finished = page.locator('#group-matches .match-card[data-match-id="wc-A-1"]');
  await expect(finished).toBeVisible();

  // The final score is shown to the user...
  await expect(finished.locator(".match-score__num")).toHaveText(["2", "1"]);
  await expect(finished.locator(".badge-done")).toBeVisible();

  // ...and there is no way to edit it.
  await expect(finished.locator(".score-box")).toHaveCount(0);
});

test("groups view: clicking a match card opens its detail (other people's predictions)", async ({ page }) => {
  await setup(page, groupAMatches());

  // Clicking the card body navigates to the match-detail page (where other
  // users' predictions are shown), preserving the matches-list behavior.
  await page.locator('#group-matches .match-card[data-match-id="wc-A-1"] .team__name').first().click();
  await expect(page).toHaveURL(/partido-detalle/);
  await expect(page).toHaveURL(/partidoId=wc-A-1/);
});

test("groups view: typing in a score box does NOT navigate away", async ({ page }) => {
  await setup(page, groupAMatches());

  // Editing a prediction must not trigger the card-detail navigation.
  await setScore(page, "wc-A-1", 2, 0);
  await expect(page).not.toHaveURL(/partido-detalle/);
  await expect(standings(page).locator(".group-table__name").first()).toHaveText("México");
});

test("home workspace shows a Groups | Matches | Friends bar; carousel is the sole group header", async ({ page }) => {
  await setup(page, groupAMatches());

  // One tab bar with the three views; Grupos is the active default for the WC.
  const tabs = page.locator(".workspace-tabs [data-home-tab]");
  await expect(tabs).toHaveText(["Grupos", "Partidos", "Torneos de Amigos"]);
  await expect(page.locator('.workspace-tabs [data-home-tab="grupos"]')).toHaveClass(/active/);

  // The merged header: the carousel labels the group and the standings table no
  // longer renders its own duplicate "Grupo A" title row (the .group-table__title
  // row is gone; the carousel header is the single group title for the table).
  await expect(carouselLabel(page)).toHaveText("Grupo A");
  await expect(standings(page).locator(".group-table__title")).toHaveCount(0);
  await expect(page.locator(".predictions-split__standings .group-carousel__label")).toHaveText("Grupo A");

  // The Matches tab still shows the classic match list.
  await page.locator('.workspace-tabs [data-home-tab="partidos"]').click();
  await expect(page.locator("#home-tab-partidos")).toBeVisible();
  await expect(page.locator("#matches-list .match-card").first()).toBeVisible();

  // Back to Grupos: editing a prediction updates the standings live.
  await page.locator('.workspace-tabs [data-home-tab="grupos"]').click();
  await setScore(page, "wc-A-1", 2, 0);
  await expect(standings(page).locator(".group-table__name").first()).toHaveText("México");
  await expect(standings(page).locator("tbody tr").first().locator(".group-table__pts")).toHaveText("3");
});

