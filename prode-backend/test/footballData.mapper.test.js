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
    lastUpdated: "2026-06-11T19:10:00Z",
    competition: { id: 2000, name: "FIFA World Cup", code: "WC", type: "CUP" },
    homeTeam: { id: 758, name: "Uruguay", shortName: "Uruguay", tla: "URU", crest: "https://example.test/uru.svg" },
    awayTeam: { id: 764, name: "Argentina", shortName: "Argentina", tla: "ARG", crest: "https://example.test/arg.svg" },
    score: { fullTime: { home: 1, away: 0 } },
  }, new Date("2026-06-11T19:34:00Z"));

  assert.equal(dto.provider, "football-data");
  assert.equal(dto.status, "EN_JUEGO");
  assert.equal(dto.minuteActual, 35);
  assert.equal(dto.competition.code, "WC");
  assert.equal(dto.homeTeam.tipo, "SELECCION");
  assert.equal(dto.scoreHome, 1);
  assert.equal(dto.scoreAway, 0);
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
