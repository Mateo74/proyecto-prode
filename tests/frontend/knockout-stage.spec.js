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
const ID = {
  MEX: "cmpkkdyir0000g8odvn98frju",
  RSA: "cmpkkdyj10001g8odhex51qvd",
  KOR: "cmpkkdykg0003g8od358yryx6",
  CZE: "cmpkkdyko0004g8odkwz3rh8t",
  CAN: "cmpkkdylb0006g8oddpqkb65m",
  SUI: "cmpkkdyol000dg8odjs7mbyh4",
  BRA: "cmpkkdypo000fg8odf04rr7yr",
  MAR: "cmpkkdypx000gg8odw22u5qec",
};

function mk(id, etapa, e1Id, e1, e2Id, e2) {
  return {
    id, competenciaId: "comp-wc", liga: "Copa Mundial FIFA", etapa,
    equipo1Id: e1Id, equipo1: e1, equipo2Id: e2Id, equipo2: e2,
    estado: "proximo", fecha: "2026-06-28T18:00:00.000Z",
    prediccionEditable: true, userPred: null,
  };
}

// Only COMPLETE matches are ever stored/returned by the backend: 4 Round-of-32
// and 1 Round-of-16. The rest of the bracket is fabricated (locked) on the client.
function knockoutMatches() {
  return [
    mk("ko-r32-1", "LAST_32", ID.MEX, "México", ID.SUI, "Suiza"),
    mk("ko-r32-2", "LAST_32", ID.BRA, "Brasil", ID.MAR, "Marruecos"),
    mk("ko-r32-3", "LAST_32", ID.KOR, "Corea del Sur", ID.CAN, "Canadá"),
    mk("ko-r32-4", "LAST_32", ID.CZE, "Chequia", ID.RSA, "Sudáfrica"),
    mk("ko-r16-1", "LAST_16", ID.MEX, "México", ID.BRA, "Brasil"),
  ];
}

async function setup(page, lang = "es") {
  await page.addInitScript((l) => localStorage.setItem("once_metros_lang", l), lang);

  await page.route("http://localhost:3000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    if (url.pathname === "/api/auth/refresh") {
      await json(route, { token: "t", usuario: { id: "u1", username: "demo", nombre: "Demo", idioma: lang } });
      return;
    }
    if (url.pathname === "/api/competencias") {
      await json(route, [{ id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" }]);
      return;
    }
    if (url.pathname === "/api/partidos") { await json(route, knockoutMatches()); return; }
    if (url.pathname === "/api/torneos") { await json(route, []); return; }
    if (url.pathname === "/api/predicciones") { await json(route, { id: "s", scoreEquipo1: 0, scoreEquipo2: 0 }); return; }
    await json(route, { message: "unhandled" }, 404);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Copa Mundial FIFA" }).click();
  await expect(page.locator("#group-carousel-label")).toHaveText("Grupo A");
}

const stageLabel = (page) => page.locator("#stage-carousel-label");
const koCards = (page) => page.locator("#stage-knockout .match-card");
const koLocked = (page) => page.locator("#stage-knockout .match-card.is-ko-locked");
const koInputs = (page) => page.locator("#stage-knockout .score-box");

async function stepToStage(page, label) {
  for (let i = 0; i < 7; i++) {
    if ((await stageLabel(page).textContent())?.trim() === label) return;
    await page.locator(".stage-carousel__next").click();
    await page.waitForTimeout(120);
  }
  throw new Error(`stage "${label}" not reached`);
}

test("knockout: the World Cup shows the full bracket stage carousel", async ({ page }) => {
  await setup(page);
  await expect(page.locator(".stage-carousel")).toBeVisible();
  await expect(page.locator("#stage-group")).toBeVisible();

  await stepToStage(page, "Dieciseisavos");
  await expect(page.locator("#stage-knockout")).toBeVisible();
  await expect(page.locator("#stage-group")).toBeHidden();
  // R32 always renders exactly 16 crosses (4 real + 12 fabricated).
  await expect(koCards(page)).toHaveCount(16);
});

test("knockout: only backend matches are predictable; the rest are locked", async ({ page }) => {
  await setup(page);
  await stepToStage(page, "Dieciseisavos");

  // 4 real matches => 4 predictable cards => 8 score inputs; 12 locked.
  await expect(koInputs(page)).toHaveCount(8);
  await expect(koLocked(page)).toHaveCount(12);

  // A real match renders with its teams and editable boxes.
  const real = page.locator('#stage-knockout .match-card[data-match-id="ko-r32-1"]');
  await expect(real).toBeVisible();
  await expect(real).not.toHaveClass(/is-ko-locked/);
  await expect(real.locator(".score-box")).toHaveCount(2);
  await expect(real.locator(".team__name").first()).toHaveText("México");
});

test("knockout: locked crosses show bracket seeds, can't be predicted, and don't navigate", async ({ page }) => {
  await setup(page);
  await stepToStage(page, "Dieciseisavos");

  const locked = koLocked(page).first();
  await expect(locked.locator(".score-box")).toHaveCount(0);
  await expect(locked.locator(".ko-lock")).toBeVisible();
  // Fabricated cards expose the real bracket seeds (e.g. "2A", "1I", "3º C/D/F…").
  await expect(page.locator("#stage-knockout .team__name--tbd", { hasText: /^[123][A-L]$|3º/ }).first()).toBeVisible();

  // Clicking a locked cross must not open the match detail.
  await locked.click();
  await expect(page).not.toHaveURL(/partido-detalle/);
});

test("knockout: later rounds pad to their expected counts", async ({ page }) => {
  await setup(page);

  // R16: one real match (México–Brasil) + 7 locked = 8 crosses, 2 inputs.
  await stepToStage(page, "Octavos");
  await expect(koCards(page)).toHaveCount(8);
  await expect(koInputs(page)).toHaveCount(2);
  await expect(page.locator('#stage-knockout .match-card[data-match-id="ko-r16-1"]')).toBeVisible();

  // QF: no real matches => 4 fully locked crosses, no inputs.
  await stepToStage(page, "Cuartos");
  await expect(koCards(page)).toHaveCount(4);
  await expect(koLocked(page)).toHaveCount(4);
  await expect(koInputs(page)).toHaveCount(0);
});
