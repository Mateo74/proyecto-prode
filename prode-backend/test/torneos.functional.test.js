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
