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

test("getMatchPredictions returns partido and all torneo members with their predictions", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario1 = { id: "u-1", nombre: "Ana", apellido: null, username: "ana", fotoPerfil: null, hinchaDe: null };
  const usuario2 = { id: "u-2", nombre: "Bob", apellido: null, username: "bob", fotoPerfil: null, hinchaDe: null };

  const partido = {
    id: "p-1",
    competenciaId: "comp-1",
    equipo1Id: "e-1",
    equipo2Id: "e-2",
    equipo1: { id: "e-1", nombre: "Argentina", nombreEn: "Argentina", nombreCompleto: null, tipo: "SELECCION", slug: "argentina", abreviatura: "ARG", escudoUrl: null },
    equipo2: { id: "e-2", nombre: "Francia", nombreEn: "France", nombreCompleto: null, tipo: "SELECCION", slug: "francia", abreviatura: "FRA", escudoUrl: null },
    competencia: { id: "comp-1", nombre: "Copa Mundial FIFA 2026", nombreEn: "FIFA World Cup 2026", slug: "copa-mundial-fifa-2026" },
    fecha: new Date("2026-07-01T20:00:00.000Z"),
    estado: "TERMINADO",
    golesEquipo1: 2,
    golesEquipo2: 1,
    equipo1EsLocal: true,
    minutoActual: null,
    fechaInicioReal: null,
    ultimaSyncExterna: null,
    ultimaActualizacionEstado: null,
    fechaActualizacion: new Date(),
    resultadoConfirmado: true,
  };

  const prediccionU1 = {
    id: "pred-1",
    usuarioId: "u-1",
    partidoId: "p-1",
    golesEquipo1Predicho: 2,
    golesEquipo2Predicho: 1,
    puntosOtorgados: 4,
  };

  const prisma = {
    torneoDeAmigos: {
      findUnique: async ({ where }) => {
        if (where.id === "t-1") return { id: "t-1", esGlobal: false, competenciaId: "comp-1", usuarios: [usuario1, usuario2] };
        return null;
      },
    },
    partido: {
      findUnique: async ({ where }) => {
        if (where.id === "p-1") return partido;
        return null;
      },
    },
    prediccion: {
      findMany: async () => [prediccionU1],
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });

  const torneosService = requireProject("src/services/torneos.service.js");
  const result = await torneosService.getMatchPredictions("t-1", "p-1");

  assert.equal(result.partido.id, "p-1");
  assert.equal(result.entries.length, 2);

  // u-1 has a prediction and should be sorted first (4 pts)
  assert.equal(result.entries[0].usuario.id, "u-1");
  assert.equal(result.entries[0].prediccion.puntosOtorgados, 4);

  // u-2 has no prediction
  assert.equal(result.entries[1].usuario.id, "u-2");
  assert.equal(result.entries[1].prediccion, null);
});

test("getMatchPredictions rejects partido from a different competition", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const prisma = {
    torneoDeAmigos: {
      findUnique: async () => ({ id: "t-1", esGlobal: false, competenciaId: "comp-1", usuarios: [] }),
    },
    partido: {
      findUnique: async () => ({
        id: "p-1", competenciaId: "comp-OTRO",
        equipo1: {}, equipo2: {}, competencia: {},
        fecha: new Date(), estado: "FUTURO",
        golesEquipo1: null, golesEquipo2: null,
        equipo1EsLocal: false, minutoActual: null,
        fechaInicioReal: null, ultimaSyncExterna: null,
        ultimaActualizacionEstado: null, fechaActualizacion: new Date(),
        resultadoConfirmado: false,
      }),
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });

  const torneosService = requireProject("src/services/torneos.service.js");
  await assert.rejects(
    () => torneosService.getMatchPredictions("t-1", "p-1"),
    err => err.status === 400,
  );
});
