const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  clearSrcModules,
  mockProjectModule,
  requireProject,
} = require("./helpers/mockProjectModules");

test("GET /api/torneos accepts competenciaId and returns serialized tournaments", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ||= "test-secret";
  clearSrcModules();

  let findManyArgs;
  const prisma = {
    torneoDeAmigos: {
      findMany: async (args) => {
        findManyArgs = args;
        return [
          {
            id: "torneo-1",
            nombre: "Once Metros - Mundial",
            esGlobal: true,
            imagen: null,
            activo: true,
            competenciaId: "comp-1",
            competencia: { id: "comp-1", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" },
            creadorId: null,
            creador: null,
            usuarios: [],
            _count: { usuarios: 0 },
            fechaCreacion: new Date("2026-06-01T00:00:00.000Z"),
          },
        ];
      },
    },
    usuario: {
      count: async () => 42,
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });

  const { createApp } = requireProject("src/app.js");
  const app = createApp();
  const response = await request(app)
    .get("/api/torneos?competenciaId=comp-1")
    .expect(200);

  assert.equal(findManyArgs.where.competenciaId, "comp-1");
  assert.equal(response.body[0].competenciaId, "comp-1");
  assert.equal(response.body[0].esGlobal, true);

  const metrics = await request(app).get("/metrics").expect(200);
  assert.match(metrics.text, /once_metros_http_requests_total/);
  assert.match(metrics.text, /route="\/api\/torneos"/);
});

test("GET /api/torneos global torneo miembrosCount comes from usuario.count", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ||= "test-secret";
  clearSrcModules();

  const prisma = {
    torneoDeAmigos: {
      findMany: async () => ([{
        id: "t-global",
        nombre: "Once Metros - Mundial",
        esGlobal: true,
        imagen: null,
        activo: true,
        competenciaId: "comp-1",
        competencia: { id: "comp-1", nombre: "Copa Mundial FIFA", slug: "copa-mundial-fifa" },
        creadorId: null,
        creador: null,
        usuarios: [],
        _count: { usuarios: 0 },
        fechaCreacion: new Date("2026-06-01T00:00:00.000Z"),
      }]),
    },
    usuario: {
      count: async () => 99,
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });
  const { createApp } = requireProject("src/app.js");
  const app = createApp();
  const response = await request(app).get("/api/torneos").expect(200);

  assert.equal(response.body[0].miembrosCount, 99, "miembrosCount should equal the active user count");
});

test("GET /api/torneos/:id/partidos/:partidoId returns partido and entries", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ||= "test-secret";
  clearSrcModules();

  const usuario = { id: "u-1", nombre: "Ana", apellido: null, username: "ana", fotoPerfil: null, hinchaDe: null };
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

  const prisma = {
    torneoDeAmigos: {
      findUnique: async ({ where }) =>
        where.id === "t-1"
          ? {
              id: "t-1", nombre: "Test Torneo", esGlobal: false, activo: true,
              competenciaId: "comp-1", competencia: null, creadorId: "u-1",
              creador: null, usuarios: [usuario], fechaCreacion: new Date(),
            }
          : null,
    },
    partido: {
      findUnique: async ({ where }) => (where.id === "p-1" ? partido : null),
    },
    prediccion: {
      findFirst: async () => null,
      findMany: async () => [{
        id: "pred-1",
        usuarioId: "u-1",
        partidoId: "p-1",
        golesEquipo1Predicho: 2,
        golesEquipo2Predicho: 1,
        puntosOtorgados: 4,
      }],
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });
  const { createApp } = requireProject("src/app.js");
  const app = createApp();
  const response = await request(app)
    .get("/api/torneos/t-1/partidos/p-1")
    .expect(200);

  assert.equal(response.body.torneo.id, "t-1");
  assert.equal(response.body.partido.id, "p-1");
  assert.equal(response.body.partido.equipo1, "Argentina");
  assert.equal(response.body.entries.length, 1);
  assert.equal(response.body.entries[0].usuario.username, "ana");
  assert.equal(response.body.entries[0].prediccion.golesEquipo1, 2);
  assert.equal(response.body.entries[0].prediccion.puntos, 4);
});

test("GET /api/invites/:token/og-preview redirects with correct language in title", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ||= "test-secret";
  process.env.FRONTEND_BASE_URL = "https://www.oncemetros.com";
  clearSrcModules();

  const prisma = {
    torneoDeAmigos: {
      findUnique: async ({ where }) =>
        where.inviteToken === "tok123"
          ? {
              id: "t-1",
              nombre: "Los Pibes",
              esGlobal: false,
              activo: true,
              competenciaId: "comp-1",
              competencia: { id: "comp-1", nombre: "Copa Mundial FIFA 2026", nombreEn: "FIFA World Cup 2026", slug: "copa-mundial-fifa-2026" },
              creadorId: "u-1",
              creador: null,
              usuarios: [],
              _count: { usuarios: 1 },
              fechaCreacion: new Date(),
            }
          : null,
    },
  };

  mockProjectModule("src/config/prisma.js", { prisma });
  const { createApp } = requireProject("src/app.js");
  const app = createApp();

  // English preview
  const enRes = await request(app)
    .get("/api/invites/tok123/og-preview?lang=en")
    .expect(200);
  assert.match(enRes.text, /FIFA World Cup 2026/, "EN og title should use nombreEn");
  assert.match(enRes.text, /Join &quot;Los Pibes&quot;|Join "Los Pibes"/, "EN title should include torneo name");

  // Spanish preview
  const esRes = await request(app)
    .get("/api/invites/tok123/og-preview?lang=es")
    .expect(200);
  assert.match(esRes.text, /Copa Mundial FIFA 2026/, "ES og title should use nombre");
  assert.match(esRes.text, /Te invitan a/, "ES title should use Spanish wording");
});
