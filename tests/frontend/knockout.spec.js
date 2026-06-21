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

// Canonical World Cup team ids (js/world-cup-2026.js), in official group order.
const GROUPS = {
  A: [["cmpkkdyir0000g8odvn98frju", "México"], ["cmpkkdyj10001g8odhex51qvd", "Sudáfrica"], ["cmpkkdykg0003g8od358yryx6", "Corea del Sur"], ["cmpkkdyko0004g8odkwz3rh8t", "Chequia"]],
  B: [["cmpkkdylb0006g8oddpqkb65m", "Canadá"], ["cmpkkdyol000dg8odjs7mbyh4", "Suiza"], ["cmpkkdyo1000cg8odqcvoomni", "Qatar"], ["cmpkkdyli0007g8odm7sbuz9b", "Bosnia-H."]],
  C: [["cmpkkdypo000fg8odf04rr7yr", "Brasil"], ["cmpkkdypx000gg8odw22u5qec", "Marruecos"], ["cmpkkdyr2000ig8odh3n51smy", "Haití"], ["cmpkkdyrb000jg8odx5i2p5tx", "Escocia"]],
  E: [["cmpkkdytk000og8odyrzqilmg", "Alemania"], ["cmpkkdyto000pg8odbz03r56m", "Curaçao"], ["cmpkkdyuy000ug8odzi6opev9", "Costa de Marfil"], ["cmpkkdyv6000vg8odgdksgl4s", "Ecuador"]],
  F: [["cmpkkdyu6000rg8odzoswp2cc", "Países Bajos"], ["cmpkkdyud000sg8odn3vngly5", "Japón"], ["cmpkkdyvr000xg8odcbhnqw74", "Suecia"], ["cmpkkdyvt000yg8odqgbbsgfg", "Túnez"]],
};

function gMatch(id, t1, t2, s1, s2, finished) {
  return {
    id, competenciaId: "comp-wc", liga: "Copa Mundial FIFA",
    equipo1Id: t1[0], equipo1: t1[1], equipo2Id: t2[0], equipo2: t2[1],
    estado: finished ? "finalizado" : "proximo",
    prediccionEditable: !finished,
    scoreEquipo1: finished ? s1 : null,
    scoreEquipo2: finished ? s2 : null,
    resultadoConfirmado: finished,
    fecha: "2026-06-15T18:00:00.000Z",
    userPred: null,
  };
}

// Round-robin where the lower-listed team always wins 1-0, so the final
// standings follow the official group order (1st, 2nd, 3rd, 4th).
function group(letter, finished) {
  const teams = GROUPS[letter];
  const out = [];
  let n = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      out.push(gMatch(`g-${letter}-${++n}`, teams[i], teams[j], 1, 0, finished));
    }
  }
  return out;
}
const finishedGroup = (l) => group(l, true);
const upcomingGroup = (l) => group(l, false);

async function setup(page, matches) {
  await page.addInitScript(() => localStorage.setItem("once_metros_lang", "es"));
  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    if (url.pathname === "/api/auth/refresh") return json(route, { token: "t", usuario: { id: "u", username: "d", nombre: "D", idioma: "es" } });
    if (url.pathname === "/api/competencias") return json(route, [{ id: "comp-wc", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" }]);
    if (url.pathname === "/api/partidos") return json(route, matches);
    if (url.pathname === "/api/torneos") return json(route, []);
    if (url.pathname === "/api/predicciones") return json(route, { id: "saved" });
    return json(route, { message: "Unhandled" }, 404);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Copa Mundial FIFA" }).click();
  await expect(stageLabel(page)).toHaveText("Fase de grupos");
}

const stageLabel = (page) => page.locator("#stage-carousel-label");
const koMatch = (page, id) => page.locator(`#stage-knockout .ko-match[data-ko-id="${id}"]`);
const nextStage = (page) => page.locator(".stage-carousel__next");
async function gotoStage(page, label) {
  for (let i = 0; i < 6; i++) {
    if ((await stageLabel(page).textContent()) === label) return;
    await nextStage(page).click();
  }
}

test("stage carousel cycles group → R32 → … → Final and wraps", async ({ page }) => {
  await setup(page, upcomingGroup("A"));
  const seq = ["Dieciseisavos", "Octavos", "Cuartos", "Semifinales", "Final", "Fase de grupos"];
  for (const label of seq) {
    await nextStage(page).click();
    await expect(stageLabel(page)).toHaveText(label);
  }
});

test("R32 matches are locked while the groups are unfinished", async ({ page }) => {
  await setup(page, upcomingGroup("A"));
  await gotoStage(page, "Dieciseisavos");

  const m73 = koMatch(page, "m73"); // 2A vs 2B
  await expect(m73).toHaveClass(/is-locked/);
  await expect(m73.locator(".ko-score--locked")).toBeVisible();
  await expect(m73.locator(".ko-score__box")).toHaveCount(0);
  // Both teams are still placeholders (slot labels), not real teams.
  await expect(m73.locator(".ko-team--tbd").nth(0)).toContainText("2A");
  await expect(m73.locator(".ko-team--tbd").nth(1)).toContainText("2B");
});

test("finished groups unlock the R32 match and resolve the real qualifiers", async ({ page }) => {
  await setup(page, [...finishedGroup("A"), ...finishedGroup("B")]);
  await gotoStage(page, "Dieciseisavos");

  // m73 = Runner-up A (Sudáfrica) vs Runner-up B (Suiza), both groups decided.
  const m73 = koMatch(page, "m73");
  await expect(m73).not.toHaveClass(/is-locked/);
  await expect(m73.locator(".ko-team__name").first()).toHaveText("Sudáfrica");
  await expect(m73.locator(".ko-team__name").last()).toHaveText("Suiza");
  await expect(m73.locator(".ko-score__box")).toHaveCount(2);
});

test("predicting a R32 score advances the winner into the Round of 16", async ({ page }) => {
  await setup(page, [...finishedGroup("A"), ...finishedGroup("B"), ...finishedGroup("C"), ...finishedGroup("F")]);
  await gotoStage(page, "Dieciseisavos");

  // m73 = Sudáfrica (2A) vs Suiza (2B): predict 2-1 -> Sudáfrica advances.
  const m73 = koMatch(page, "m73");
  await m73.locator('.ko-score__box[data-side="a"]').fill("2");
  await m73.locator('.ko-score__box[data-side="b"]').fill("1");
  await expect(m73.locator(".ko-team").first()).toHaveClass(/is-winner/);

  // m75 = Países Bajos (1F) vs Marruecos (2C): predict 3-0 -> Países Bajos advances.
  const m75 = koMatch(page, "m75");
  await expect(m75).not.toHaveClass(/is-locked/);
  await m75.locator('.ko-score__box[data-side="a"]').fill("3");
  await m75.locator('.ko-score__box[data-side="b"]').fill("0");

  // R16 m89 = Winner m73 vs Winner m75 -> both predicted -> unlocked with the
  // advancing teams shown.
  await gotoStage(page, "Octavos");
  const m89 = koMatch(page, "m89");
  await expect(m89).not.toHaveClass(/is-locked/);
  await expect(m89.locator(".ko-team__name").first()).toHaveText("Sudáfrica");
  await expect(m89.locator(".ko-team__name").last()).toHaveText("Países Bajos");
});

test("a draw prediction reveals the penalty-advance selector", async ({ page }) => {
  await setup(page, [...finishedGroup("A"), ...finishedGroup("B")]);
  await gotoStage(page, "Dieciseisavos");

  const m73 = koMatch(page, "m73");
  await m73.locator('.ko-score__box[data-side="a"]').fill("1");
  await m73.locator('.ko-score__box[data-side="b"]').fill("1");

  // Draw -> penalty selector appears; choosing Suiza marks it the winner.
  const pens = m73.locator(".ko-pens");
  await expect(pens).toBeVisible();
  await pens.locator('.ko-pens__btn[data-pen="b"]').click();
  await expect(m73.locator(".ko-team").last()).toHaveClass(/is-winner/);
});

test("third-place R32 slots stay locked until every group is decided", async ({ page }) => {
  // Only group E is finished, so Winner E is known but the 3rd-place opponent
  // (which needs the full third-place ranking) is not.
  await setup(page, [...finishedGroup("E")]);
  await gotoStage(page, "Dieciseisavos");

  const m74 = koMatch(page, "m74"); // 1E vs 3rd A/B/C/D/F
  await expect(m74).toHaveClass(/is-locked/);
  await expect(m74.locator(".ko-team__name").first()).toHaveText("Alemania");
  await expect(m74.locator(".ko-team--tbd")).toContainText("3º A/B/C/D/F");
});
