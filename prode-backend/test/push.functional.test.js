/**
 * push.functional.test.js
 * Functional tests for the /api/push endpoints (Expo token registration).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  clearSrcModules,
  mockProjectModule,
  requireProject,
} = require("./helpers/mockProjectModules");

const jwt = require("jsonwebtoken");

const JWT_SECRET = "test-secret";
const VALID_EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function makeToken(userId = "u-1") {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "1h" });
}

function setupMocks({ upsertFn, deleteFn, userId = "u-1" } = {}) {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = JWT_SECRET;
  clearSrcModules();

  const usuario = {
    id: userId, nombre: "Test", apellido: null, username: "test",
    activo: true, rol: "USER", hinchaDe: null,
  };

  mockProjectModule("src/config/prisma.js", {
    prisma: {
      usuario: { findUnique: async () => usuario },
      expoToken: {
        upsert: upsertFn || (async () => {}),
        deleteMany: deleteFn || (async () => {}),
      },
    },
  });

  const { createApp } = requireProject("src/app.js");
  return createApp();
}

test("POST /api/push/register saves token", async () => {
  let saved = null;
  const app = setupMocks({ upsertFn: async (args) => { saved = args; } });

  const token = makeToken("u-1");
  await request(app)
    .post("/api/push/register")
    .set("Authorization", `Bearer ${token}`)
    .send({ token: VALID_EXPO_TOKEN })
    .expect(201);

  assert.ok(saved, "upsert should have been called");
  assert.equal(saved.create.token, VALID_EXPO_TOKEN);
  assert.equal(saved.create.usuarioId, "u-1");
});

test("POST /api/push/register returns 401 without auth", async () => {
  const app = setupMocks();
  await request(app)
    .post("/api/push/register")
    .send({ token: VALID_EXPO_TOKEN })
    .expect(401);
});

test("POST /api/push/register returns 400 for invalid token", async () => {
  const app = setupMocks();
  const token = makeToken();
  await request(app)
    .post("/api/push/register")
    .set("Authorization", `Bearer ${token}`)
    .send({ token: "not-an-expo-token" })
    .expect(400);
});

test("POST /api/push/unregister removes token", async () => {
  let deletedWhere = null;
  const app = setupMocks({ deleteFn: async ({ where }) => { deletedWhere = where; } });

  const token = makeToken("u-1");
  await request(app)
    .post("/api/push/unregister")
    .set("Authorization", `Bearer ${token}`)
    .send({ token: VALID_EXPO_TOKEN })
    .expect(200);

  assert.equal(deletedWhere.usuarioId, "u-1");
  assert.equal(deletedWhere.token, VALID_EXPO_TOKEN);
});

test("POST /api/push/unregister returns 401 without auth", async () => {
  const app = setupMocks();
  await request(app)
    .post("/api/push/unregister")
    .send({ token: VALID_EXPO_TOKEN })
    .expect(401);
});
