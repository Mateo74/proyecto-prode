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

// Real Equipo ids from js/world-cup-2026.js.
const MEXICO = "cmpkkdyir0000g8odvn98frju"; // Group A
const SUDAFRICA = "cmpkkdyj10001g8odhex51qvd"; // Group A
const SUIZA = "cmpkkdyol000dg8odjs7mbyh4"; // Group B

// One group-stage match (so the Grupos view has content) plus two R32 fixtures:
// one with both teams decided (predictable) and one still undecided (locked).
function matches() {
  return [
    {
      id: "wc-A-1", competenciaId: "comp-wc", liga: "Copa Mundial FIFA", etapa: "GROUP_STAGE",
      equipo1Id: MEXICO, equipo1: "México", equipo2Id: SUDAFRICA, equipo2: "Sudáfrica",
      estado: "proximo", fecha: "2026-06-15T18:00:00.000Z", prediccionEditable: true, userPred: null,
    },
    {
      id: "wc-R32-1", competenciaId: "comp-wc", liga: "Copa Mundial FIFA", etapa: "LAST_32",
      equipo1Id: MEXICO, equipo1: "México", equipo2Id: SUIZA, equipo2: "Suiza",
      estado: "proximo", fecha: "2026-06-28T18:00:00.000Z", prediccionEditable: true, userPred: null,
    },
    {
      id: "wc-R32-2", competenciaId: "comp-wc", liga: "Copa Mundial FIFA", etapa: "LAST_32",
      equipo1Id: null, equipo1: null, equipo2Id: null, equipo2: null,
      estado: "proximo", fecha: "2026-06-28T21:00:00.000Z", prediccionEditable: false, userPred: null,
    },
  ];
}

async function setup(page, lang = "es") {
  await page.addInitScript((l) => { localStorage.setItem("once_metros_lang", l); }, lang);

  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    if (url.pathname === "/api/auth/refresh") {
      await json(route, { token: "access-token", usuario: { id: "user-1", username: "demo", nombre: "Demo", idioma: lang } });
      return;
    }
    if (url.pathname === "/api/competencias") {
      await json(route, [{ id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" }]);
      return;
    }
    if (url.pathname === "/api/partidos") { await json(route, matches()); return; }
    if (url.pathname === "/api/torneos") { await json(route, []); return; }
    if (url.pathname === "/api/predicciones") { await json(route, { id: "saved", scoreEquipo1: 0, scoreEquipo2: 0 }); return; }
    await json(route, { message: "Unhandled API route" }, 404);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Copa Mundial FIFA" }).click();
  await expect(page.locator("#group-carousel-label")).toHaveText("Grupo A");
}

const stageLabel = (page) => page.locator("#stage-carousel-label");
const koCard = (page, id) => page.locator(`#stage-knockout .match-card[data-match-id="${id}"]`);

test("knockout: the stage carousel appears only when knockout fixtures exist", async ({ page }) => {
  await setup(page);
  // R32 fixtures are present, so the stage switcher is shown above the group view.
  await expect(page.locator(".stage-carousel")).toBeVisible();
  // The group stage is the default; the knockout pane stays hidden.
  await expect(page.locator("#stage-group")).toBeVisible();
  await expect(page.locator("#stage-knockout")).toBeHidden();
});

test("knockout: switching to R32 renders DB matches with the existing cards", async ({ page }) => {
  await setup(page);

  await page.locator(".stage-carousel__next").click();
  await expect(stageLabel(page)).toHaveText("Dieciseisavos");
  await expect(page.locator("#stage-knockout")).toBeVisible();
  await expect(page.locator("#stage-group")).toBeHidden();

  // The decided fixture reuses the standard match card with editable score boxes.
  const decided = koCard(page, "wc-R32-1");
  await expect(decided).toBeVisible();
  await expect(decided.locator(".score-box")).toHaveCount(2);
  await expect(decided.locator(".team__name").first()).toHaveText("México");
});

test("knockout: an undecided cross shows a locked card (TBD + lock, no inputs)", async ({ page }) => {
  await setup(page);
  await page.locator(".stage-carousel__next").click();

  const locked = koCard(page, "wc-R32-2");
  await expect(locked).toBeVisible();
  await expect(locked).toHaveClass(/is-ko-locked/);
  // Locked crosses can't be predicted: no score inputs, a lock, and "Por definir".
  await expect(locked.locator(".score-box")).toHaveCount(0);
  await expect(locked.locator(".ko-lock")).toBeVisible();
  await expect(locked.locator(".team__name--tbd").first()).toHaveText("Por definir");

  // Clicking a locked card must not navigate anywhere.
  await locked.click();
  await expect(page).not.toHaveURL(/partido-detalle/);
});
