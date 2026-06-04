const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, requireProject } = require("./helpers/mockProjectModules");

test("getLiveMatches calls football-data with token and maps the response", async (t) => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.FOOTBAL_DATA_TOKEN = "football-token";
  process.env.FOOTBALL_DATA_BASE_URL = "https://football-data.test/v4";
  clearSrcModules();

  t.mock.method(global, "fetch", async (url, options) => ({
    ok: true,
    status: 200,
    json: async () => ({
      matches: [
        {
          id: 391889,
          utcDate: "2026-06-11T19:00:00Z",
          status: "IN_PLAY",
          lastUpdated: "2026-06-11T19:10:00Z",
          competition: { id: 2000, name: "FIFA World Cup", code: "WC", type: "CUP" },
          homeTeam: { id: 758, name: "Uruguay", shortName: "Uruguay", tla: "URU", crest: "" },
          awayTeam: { id: 764, name: "Argentina", shortName: "Argentina", tla: "ARG", crest: "" },
          score: { fullTime: { home: 1, away: 0 } },
        },
      ],
    }),
  }));

  const provider = requireProject("src/providers/footballData.provider.js");
  const matches = await provider.getLiveMatches();
  const fetchCall = global.fetch.mock.calls[0];

  assert.equal(fetchCall.arguments[0].toString(), "https://football-data.test/v4/matches?status=LIVE");
  assert.equal(fetchCall.arguments[1].headers["X-Auth-Token"], "football-token");
  assert.equal(matches[0].externalId, "391889");
  assert.equal(matches[0].status, "EN_JUEGO");
});
