const test = require("node:test");
const assert = require("node:assert/strict");
const { mapCompetition, mapMatch, mapStatus } = require("../src/providers/footballData.mapper");

test("mapStatus normaliza estados externos a estados internos", () => {
  assert.equal(mapStatus("SCHEDULED"), "PROGRAMADO");
  assert.equal(mapStatus("IN_PLAY"), "EN_JUEGO");
  assert.equal(mapStatus("PAUSED"), "EN_JUEGO");
  assert.equal(mapStatus("FINISHED"), "TERMINADO");
  assert.equal(mapStatus("SUSPENDED"), "SUSPENDIDO");
  assert.equal(mapStatus("CANCELLED"), "CANCELADO");
});

test("mapMatch devuelve un DTO interno desacoplado de football-data", () => {
  const dto = mapMatch({
    id: 391889,
    utcDate: "2026-06-11T19:00:00Z",
    status: "IN_PLAY",
    stage: "GROUP_STAGE",
    lastUpdated: "2026-06-11T19:10:00Z",
    competition: { id: 2000, name: "FIFA World Cup", code: "WC", type: "CUP" },
    homeTeam: { id: 758, name: "Uruguay", shortName: "Uruguay", tla: "URU", crest: "https://example.test/uru.svg" },
    awayTeam: { id: 764, name: "Argentina", shortName: "Argentina", tla: "ARG", crest: "https://example.test/arg.svg" },
    score: { fullTime: { home: 1, away: 0 } },
  }, new Date("2026-06-11T19:34:00Z"));

  assert.equal(dto.provider, "football-data");
  assert.equal(dto.status, "EN_JUEGO");
  assert.equal(dto.stage, "GROUP_STAGE");
  assert.equal(dto.minuteActual, 35);
  assert.equal(dto.competition.code, "WC");
  assert.equal(dto.homeTeam.tipo, "SELECCION");
  assert.equal(dto.scoreHome, 1);
  assert.equal(dto.scoreAway, 0);
});

test("mapMatch expone la etapa de eliminatorias (stage) del proveedor", () => {
  const dto = mapMatch({
    id: 537421,
    utcDate: "2026-07-02T00:00:00Z",
    status: "TIMED",
    stage: "LAST_32",
    competition: { id: 2000, name: "FIFA World Cup", code: "WC", type: "CUP" },
    homeTeam: { id: 771, name: "United States", shortName: "USA", tla: "USA", crest: "https://example.test/usa.svg" },
    awayTeam: { id: 1060, name: "Bosnia-Herzegovina", shortName: "Bosnia-H.", tla: "BIH", crest: "https://example.test/bih.svg" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
  });

  assert.equal(dto.stage, "LAST_32");
  assert.equal(dto.homeTeam.nombre, "USA");
  assert.equal(dto.awayTeam.nombre, "Bosnia-H.");
});

test("mapMatch usa regularTime+extraTime para PENALTY_SHOOTOUT (ignora penalties incorrecto)", () => {
  // CL Final 2026: PSG 1-1 Arsenal (aet), PSG wins 4-3 on pens
  // API reported penalties: {home:3, away:3} which is wrong — we should get 1-1
  const dto = mapMatch({
    id: 552096,
    utcDate: "2026-05-30T16:00:00Z",
    status: "FINISHED",
    lastUpdated: "2026-05-30T19:19:09Z",
    competition: { id: 2001, name: "UEFA Champions League", code: "CL", type: "CUP" },
    homeTeam: { id: 524, name: "Paris Saint-Germain FC", shortName: "PSG", tla: "PSG", crest: "" },
    awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crest: "" },
    score: {
      winner: null,
      duration: "PENALTY_SHOOTOUT",
      fullTime:    { home: 5, away: 4 },
      halfTime:    { home: 0, away: 1 },
      regularTime: { home: 1, away: 1 },
      extraTime:   { home: 0, away: 0 },
      penalties:   { home: 3, away: 3 }, // wrong API data — should be 4-3
    },
  });

  assert.equal(dto.scoreHome, 1, "score should be 1 (regularTime), not 2 (fullTime - wrongPenalties)");
  assert.equal(dto.scoreAway, 1, "score should be 1 (regularTime), not 1");
});

test("mapCompetition normaliza competencias externas", () => {
  const dto = mapCompetition({
    id: 2001,
    name: "UEFA Champions League",
    code: "CL",
    type: "CUP",
    emblem: "https://crests.football-data.org/CL.png",
    area: { id: 2077, name: "Europe", code: "EUR" },
    lastUpdated: "2024-09-13T16:53:48Z",
  });

  assert.equal(dto.provider, "football-data");
  assert.equal(dto.externalId, "2001");
  assert.equal(dto.code, "CL");
  assert.equal(dto.area.code, "EUR");
});
