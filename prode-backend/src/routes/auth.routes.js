const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { registry } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { z } = require("../openapi/registry");
const { googleLoginBody, loginBody, mobileGoogleLoginBody, registerBody, sessionResponse, usuarioPayload, forgotPasswordBody, resetPasswordBody } =
  require("../schemas/auth.schema");
const { errorResponse } = require("../schemas/common.schema");
const controller = require("../controllers/auth.controller");

const router = Router();

// 10 attempts per 15 minutes per IP on sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intentá de nuevo en 15 minutos." },
});

// More lenient limit for refresh (used silently by the app)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intentá de nuevo más tarde." },
});

router.post("/register", authLimiter, validate({ body: registerBody }), asyncRoute(controller.register));
router.post("/login", authLimiter, validate({ body: loginBody }), asyncRoute(controller.login));
router.post("/google", authLimiter, validate({ body: googleLoginBody }), asyncRoute(controller.googleLogin));
router.post("/google/mobile", authLimiter, validate({ body: mobileGoogleLoginBody }), asyncRoute(controller.mobileGoogleLogin));
router.post("/forgot-password", authLimiter, validate({ body: forgotPasswordBody }), asyncRoute(controller.forgotPassword));
router.post("/reset-password", authLimiter, validate({ body: resetPasswordBody }), asyncRoute(controller.resetPassword));
router.post("/refresh", refreshLimiter, asyncRoute(controller.refresh));
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

registry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: forgotPasswordBody } } } },
  responses: {
    200: { 
      description: "Solicitud procesada (siempre devuelve 200 para prevenir user enumeration)", 
      content: { "application/json": { schema: z.object({ ok: z.boolean(), message: z.string() }) } } 
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: resetPasswordBody } } } },
  responses: {
    200: { description: "Contraseña reiniciada, usuario autenticado", content: { "application/json": { schema: sessionResponse } } },
    400: { description: "Token inválido, expirado o ya utilizado", content: { "application/json": { schema: errorResponse } } },
  },
});

module.exports = router;
