/**
 * notifications.service.test.js
 * Unit tests for the match-reminder notification logic.
 * Uses full module mocking (no real DB or push network calls).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clearSrcModules,
  mockProjectModule,
  requireProject,
} = require("./helpers/mockProjectModules");

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-15T10:00:00.000Z");

// Default hoursUntil=23.8 puts the match inside the 24h window [23h43min, 24h2min].
function makePartido({ id = "p-1", hoursUntil = 23.8, competenciaId = "comp-1" } = {}) {
  return {
    id,
    fecha: new Date(NOW.getTime() + hoursUntil * 60 * 60 * 1000),
    competenciaId,
    competencia: { nombre: "Copa Mundial FIFA", nombreEn: "FIFA World Cup", slug: "copa-mundial-fifa" },
    equipo1: { nombre: "Argentina" },
    equipo2: { nombre: "Brasil" },
  };
}

function makeUsuario({ id = "u-1", idioma = "es", tokens = ["ExponentPushToken[test-1]"] } = {}) {
  return {
    id,
    idioma,
    expoTokens: tokens.map((token, i) => ({
      id: `tok-${i}`,
      token,
    })),
  };
}

function makePrisma({ partidos = [], usuarios = [], predicciones = [] } = {}) {
  return {
    partido: {
      findMany: async () => partidos,
    },
    usuario: {
      findMany: async () => usuarios,
    },
    prediccion: {
      findMany: async () => predicciones,
    },
    expoToken: {
      deleteMany: async () => {},
    },
  };
}

// ── Tests: findUsersToNotify ──────────────────────────────────────────────────

test("findUsersToNotify: returns empty when no upcoming matches", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma({ partidos: [] }) });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);
  assert.deepEqual(result, []);
});

test("findUsersToNotify: returns empty when no users have tokens", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const prisma = makePrisma({
    partidos: [makePartido()],
    usuarios: [makeUsuario({ tokens: [] })],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);
  assert.deepEqual(result, []);
});

test("findUsersToNotify: returns one aggregated entry for user with one unpredicted match", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [makePartido({ id: "p-1", hoursUntil: 23.8 })],
    usuarios: [usuario],
    predicciones: [],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);

  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "u-1");
  assert.equal(result[0].horasAntes, 24);
  assert.equal(result[0].partidos.length, 1);
  assert.equal(result[0].partidos[0].partidoId, "p-1");
  assert.equal(result[0].partidos[0].equipo1, "Argentina");
  assert.equal(result[0].partidos[0].equipo2, "Brasil");
});

test("findUsersToNotify: aggregates multiple matches into one entry per window", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [
      makePartido({ id: "p-1", hoursUntil: 23.8 }),  // 24h window
      makePartido({ id: "p-2", hoursUntil: 23.9 }),  // 24h window
      makePartido({ id: "p-3", hoursUntil: 1.9  }),  // 2h window [1h43min, 2h2min]
    ],
    usuarios: [usuario],
    predicciones: [],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);

  // Two entries: one 24h (p-1, p-2) and one 2h (p-3)
  assert.equal(result.length, 2);
  const entry24 = result.find((e) => e.horasAntes === 24);
  const entry2  = result.find((e) => e.horasAntes === 2);
  assert.ok(entry24, "should have 24h entry");
  assert.ok(entry2,  "should have 2h entry");
  assert.equal(entry24.partidos.length, 2);
  assert.equal(entry2.partidos.length, 1);
});

test("findUsersToNotify: classifies match 1.9h away as 2h reminder", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario();
  const prisma = makePrisma({
    partidos: [makePartido({ hoursUntil: 1.9 })],  // 1h54min: inside 2h window [1h43min, 2h2min]
    usuarios: [usuario],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);

  assert.equal(result[0].horasAntes, 2);
});

test("findUsersToNotify: excludes user who already predicted", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [makePartido({ id: "p-1" })],
    usuarios: [usuario],
    predicciones: [{ usuarioId: "u-1", partidoId: "p-1" }],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);
  assert.deepEqual(result, []);
});

test("findUsersToNotify: only notifies user missing prediction, skips one with it", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const u1 = makeUsuario({ id: "u-1", tokens: ["ExponentPushToken[ep1]"] });
  const u2 = makeUsuario({ id: "u-2", tokens: ["ExponentPushToken[ep2]"] });
  const prisma = makePrisma({
    partidos: [makePartido({ id: "p-1" })],
    usuarios: [u1, u2],
    predicciones: [{ usuarioId: "u-2", partidoId: "p-1" }],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);

  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "u-1");
});

test("findUsersToNotify: partial prediction leaves remaining matches in entry", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [
      makePartido({ id: "p-1", hoursUntil: 23.8 }),  // 24h window
      makePartido({ id: "p-2", hoursUntil: 23.9 }),  // 24h window
    ],
    usuarios: [usuario],
    predicciones: [{ usuarioId: "u-1", partidoId: "p-1" }], // predicted p-1 only
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  const result = await findUsersToNotify(NOW);

  assert.equal(result.length, 1);
  assert.equal(result[0].partidos.length, 1);
  assert.equal(result[0].partidos[0].partidoId, "p-2");
});

test("findUsersToNotify: skips match already in sentSet for same window", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [makePartido({ id: "p-1", hoursUntil: 23.8 })],
    usuarios: [usuario],
    predicciones: [],
  });
  mockProjectModule("src/config/prisma.js", { prisma });

  const { findUsersToNotify } = requireProject("src/services/notifications.service.js");
  // Pre-populate the sentSet as if this was already sent in a previous run
  const sentSet = new Set(["u-1:p-1:24"]);
  const result = await findUsersToNotify(NOW, sentSet);
  assert.deepEqual(result, []);
});

// ── Tests: buildPayload ───────────────────────────────────────────────────────

test("buildPayload: single match — Spanish 24h payload", () => {
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma() });
  mockProjectModule("src/services/push.service.js", { sendNotification: async () => ({}) });

  const { buildPayload } = requireProject("src/services/notifications.service.js");
  const payload = buildPayload(
    {
      partidos: [{ equipo1: "Argentina", equipo2: "Brasil", competenciaSlug: "copa-mundial-fifa", partidoId: "p-1" }],
      horasAntes: 24,
      idioma: "es",
    },
    "https://www.oncemetros.com"
  );

  assert.equal(payload.title, "Argentina vs Brasil");
  assert.match(payload.body, /mañana/i);
  assert.match(payload.data.url, /copa-mundial-fifa/);
});

test("buildPayload: single match — English 2h payload", () => {
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma() });
  mockProjectModule("src/services/push.service.js", { sendNotification: async () => ({}) });

  const { buildPayload } = requireProject("src/services/notifications.service.js");
  const payload = buildPayload(
    {
      partidos: [{ equipo1: "Argentina", equipo2: "Brasil", competenciaSlug: "copa-mundial-fifa", partidoId: "p-1" }],
      horasAntes: 2,
      idioma: "en",
    },
    "https://www.oncemetros.com"
  );

  assert.match(payload.body, /2 hours/);
});

test("buildPayload: multiple matches — aggregated Spanish 24h payload", () => {
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma() });
  mockProjectModule("src/services/push.service.js", { sendNotification: async () => ({}) });

  const { buildPayload } = requireProject("src/services/notifications.service.js");
  const payload = buildPayload(
    {
      partidos: [
        { equipo1: "Argentina", equipo2: "Francia", competenciaSlug: "copa-mundial-fifa", partidoId: "p-1" },
        { equipo1: "Brasil",    equipo2: "Alemania", competenciaSlug: "copa-mundial-fifa", partidoId: "p-2" },
        { equipo1: "España",    equipo2: "Portugal", competenciaSlug: "copa-mundial-fifa", partidoId: "p-3" },
      ],
      horasAntes: 24,
      idioma: "es",
    },
    "https://www.oncemetros.com"
  );

  assert.match(payload.title, /mañana/i);
  assert.match(payload.body, /Argentina vs Francia/);
  assert.match(payload.body, /2 partido/);  // "2 partidos más"
  assert.match(payload.data.url, /copa-mundial-fifa/);
});

test("buildPayload: multiple matches — aggregated English 2h payload", () => {
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma() });
  mockProjectModule("src/services/push.service.js", { sendNotification: async () => ({}) });

  const { buildPayload } = requireProject("src/services/notifications.service.js");
  const payload = buildPayload(
    {
      partidos: [
        { equipo1: "Argentina", equipo2: "France", competenciaSlug: "copa-mundial-fifa", partidoId: "p-1" },
        { equipo1: "Brazil",    equipo2: "Germany", competenciaSlug: "copa-mundial-fifa", partidoId: "p-2" },
      ],
      horasAntes: 2,
      idioma: "en",
    },
    "https://www.oncemetros.com"
  );

  assert.match(payload.title, /soon/i);
  assert.match(payload.body, /Argentina vs France/);
  assert.match(payload.body, /1 other game/);
  assert.match(payload.body, /2 hours/);
});

test("buildPayload: multi-competencia uses generic url", () => {
  clearSrcModules();
  mockProjectModule("src/config/prisma.js", { prisma: makePrisma() });
  mockProjectModule("src/services/push.service.js", { sendNotification: async () => ({}) });

  const { buildPayload } = requireProject("src/services/notifications.service.js");
  const payload = buildPayload(
    {
      partidos: [
        { equipo1: "A", equipo2: "B", competenciaSlug: "comp-1", partidoId: "p-1" },
        { equipo1: "C", equipo2: "D", competenciaSlug: "comp-2", partidoId: "p-2" },
      ],
      horasAntes: 24,
      idioma: "es",
    },
    "https://www.oncemetros.com"
  );

  assert.match(payload.data.url, /\/#predicciones$/);
  assert.doesNotMatch(payload.data.url, /competencia=/);
});

// ── Tests: sendMatchReminders ─────────────────────────────────────────────────

test("sendMatchReminders: sends one notification per user-window and updates sentSet", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  const prisma = makePrisma({
    partidos: [makePartido({ id: "p-1" })],
    usuarios: [usuario],
  });
  mockProjectModule("src/config/prisma.js", { prisma });
  mockProjectModule("src/services/push.service.js", {
    sendNotification: async () => ({ sent: true }),
  });

  const { sendMatchReminders } = requireProject("src/services/notifications.service.js");
  const sentSet = new Set();
  const summary = await sendMatchReminders("https://www.oncemetros.com", sentSet, NOW);

  assert.equal(summary.sent, 1);
  assert.equal(summary.expired, 0);
  assert.equal(summary.failed, 0);
  // sentSet should now contain this entry so the next run skips it
  assert.ok(sentSet.has("u-1:p-1:24"), "sentSet should be updated after send");
});

test("sendMatchReminders: deletes expired tokens", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  clearSrcModules();

  const usuario = makeUsuario({ id: "u-1" });
  let deletedTokenIds = [];
  const prisma = {
    ...makePrisma({
      partidos: [makePartido()],
      usuarios: [usuario],
    }),
    expoToken: {
      deleteMany: async ({ where }) => { deletedTokenIds = where.id.in; },
    },
  };
  mockProjectModule("src/config/prisma.js", { prisma });
  mockProjectModule("src/services/push.service.js", {
    sendNotification: async () => ({ sent: false, reason: "expired" }),
  });

  const { sendMatchReminders } = requireProject("src/services/notifications.service.js");
  const summary = await sendMatchReminders("https://www.oncemetros.com", new Set(), NOW);

  assert.equal(summary.expired, 1);
  assert.equal(deletedTokenIds.length, 1);
  assert.equal(deletedTokenIds[0], "tok-0");
});
