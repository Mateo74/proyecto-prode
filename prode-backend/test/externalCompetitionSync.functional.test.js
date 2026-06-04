const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const {
  clearSrcModules,
  mockProjectModule,
  requireProject,
} = require("./helpers/mockProjectModules");

test("syncExternalCompetitions uses mocked football-data and DB dependencies", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const prisma = {
    competencia: {
      findFirst: mock.fn(async () => null),
      create: mock.fn(async ({ data }) => ({ id: "comp-created", ...data })),
      update: mock.fn(),
    },
  };

  const footballDataProvider = {
    getCompetitions: mock.fn(async () => [
      {
        provider: "football-data",
        externalId: "2000",
        name: "FIFA World Cup",
        code: "WC",
        type: "CUP",
        emblem: "",
        area: { id: 1, name: "World", code: "INT" },
      },
    ]),
  };

  const logger = { info: mock.fn(), warn: mock.fn(), error: mock.fn(), debug: mock.fn() };

  mockProjectModule("src/config/prisma.js", { prisma });
  mockProjectModule("src/providers/footballData.provider.js", footballDataProvider);
  mockProjectModule("src/utils/logger.js", logger);

  const { syncExternalCompetitions } = requireProject("src/services/externalCompetitionSync.service.js");
  const summary = await syncExternalCompetitions();

  assert.deepEqual(summary, { received: 1, created: 1, updated: 0, visible: 1 });
  assert.equal(footballDataProvider.getCompetitions.mock.calls.length, 1);
  assert.equal(prisma.competencia.create.mock.calls[0].arguments[0].data.slug, "copa-mundial-fifa");
});
