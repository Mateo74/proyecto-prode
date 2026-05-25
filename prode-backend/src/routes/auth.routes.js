const { Router } = require("express");
const { registry } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { z } = require("../openapi/registry");
const { googleLoginBody, loginBody, registerBody, sessionResponse, usuarioPayload } =
  require("../schemas/auth.schema");
const { errorResponse } = require("../schemas/common.schema");
const controller = require("../controllers/auth.controller");

const router = Router();

router.post("/register", validate({ body: registerBody }), asyncRoute(controller.register));
router.post("/login", validate({ body: loginBody }), asyncRoute(controller.login));
router.post("/google", validate({ body: googleLoginBody }), asyncRoute(controller.googleLogin));
router.post("/refresh", asyncRoute(controller.refresh));
router.post("/logout", asyncRoute(controller.logout));
router.get("/me", requireAuth, asyncRoute(controller.me));

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: registerBody } } } },
  responses: {
    201: { description: "Cuenta creada", content: { "application/json": { schema: sessionResponse } } },
    409: { description: "Ya existe", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: loginBody } } } },
  responses: {
    200: { description: "Sesion iniciada", content: { "application/json": { schema: sessionResponse } } },
    401: { description: "Credenciales invalidas", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/google",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: googleLoginBody } } } },
  responses: {
    200: { description: "Sesion iniciada con Google", content: { "application/json": { schema: sessionResponse } } },
    401: { description: "Token invalido", content: { "application/json": { schema: errorResponse } } },
    503: { description: "Google auth no configurado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  responses: { 200: { description: "OK" } },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Usuario actual",
      content: { "application/json": { schema: z.object({ usuario: usuarioPayload }) } },
    },
    401: { description: "No autenticado", content: { "application/json": { schema: errorResponse } } },
  },
});

module.exports = router;
