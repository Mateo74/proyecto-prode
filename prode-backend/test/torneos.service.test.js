const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clearSrcModules,
  mockProjectModule,
  requireProject,
} = require("./helpers/mockProjectModules");

test("list applies competenciaId at the database layer", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  let findManyArgs;
  const prisma = {
    torneoDeAmigos: {
      findMany: async (args) => {
        findManyArgs = args;
        return [];
      },
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });

  const torneosService = requireProject("src/services/torneos.service.js");
  await torneosService.list({ competenciaId: "comp-1" });

  assert.deepEqual(findManyArgs.where, {
    competenciaId: "comp-1",
    competencia: { visible: true },
  });
});

test("list combines user visibility with global tournaments and competenciaId", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  let findManyArgs;
  const prisma = {
    torneoDeAmigos: {
      findMany: async (args) => {
        findManyArgs = args;
        return [];
      },
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });

  const torneosService = requireProject("src/services/torneos.service.js");
  await torneosService.list({ usuarioId: "user-1", competenciaId: "comp-1" });

  assert.deepEqual(findManyArgs.where, {
    OR: [
      { esGlobal: true, competenciaId: "comp-1", competencia: { visible: true } },
      {
        usuarios: { some: { id: "user-1" } },
        competenciaId: "comp-1",
        competencia: { visible: true },
      },
    ],
  });
});
