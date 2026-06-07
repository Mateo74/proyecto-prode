const { Router } = require("express");
const { registry, z } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { optionalAuth, requireAuth } = require("../middlewares/auth.middleware");
const { idParam, errorResponse } = require("../schemas/common.schema");
const { createTorneoBody, tablaEntryPayload, torneoPayload } =
  require("../schemas/torneos.schema");
const { prediccionPayload } = require("../schemas/predicciones.schema");
const {
  crearInvitacionBody,
  invitacionPayload,
  inviteLinkPayload,
} = require("../schemas/invitaciones.schema");
const controller = require("../controllers/torneos.controller");

const router = Router();
const listQuery = z.object({
  mias: z.enum(["true", "false"]).optional(),
  competenciaId: z.string().trim().min(1).optional(),
});
const userPredParams = z.object({ id: z.string().min(1), usuarioId: z.string().min(1) });

router.get("/", optionalAuth, validate({ query: listQuery }), asyncRoute(controller.list));
router.post(
  "/",
  requireAuth,
  validate({ body: createTorneoBody }),
  asyncRoute(controller.create),
);
router.get("/:id", validate({ params: idParam }), asyncRoute(controller.getById));
router.post(
  "/:id/unirse",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.unirse),
);
router.get(
  "/:id/tabla",
  validate({ params: idParam }),
  asyncRoute(controller.getTabla),
);
router.get(
  "/:id/mis-predicciones",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.getMisPredicciones),
);

router.get(
  "/:id/usuarios/:usuarioId/predicciones",
  optionalAuth,
  validate({ params: userPredParams }),
  asyncRoute(controller.getPrediccionesDeUsuario),
);

router.get(
  "/:id/partidos/:partidoId",
  optionalAuth,
  validate({ params: z.object({ id: z.string().min(1), partidoId: z.string().min(1) }) }),
  asyncRoute(controller.getMatchPredicciones),
);

// Creator-only: invitaciones e invite link
router.post(
  "/:id/invitaciones",
  requireAuth,
  validate({ params: idParam, body: crearInvitacionBody }),
  asyncRoute(controller.invitarUsuario),
);
router.get(
  "/:id/invitaciones",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.listarInvitacionesDelTorneo),
);
router.get(
  "/:id/invite-link",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.getInviteLink),
);
router.post(
  "/:id/invite-link",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.rotateInviteLink),
);
router.delete(
  "/:id/invite-link",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.revokeInviteLink),
);

router.delete(
  "/:id/salir",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.leaveUser),
);

router.patch(
  "/:id",
  requireAuth,
  validate({ params: idParam, body: z.object({ nombre: z.string().min(1).max(80) }) }),
  asyncRoute(controller.update),
);

router.delete(
  "/:id",
  requireAuth,
  validate({ params: idParam }),
  asyncRoute(controller.remove),
);

registry.registerPath({
  method: "get",
  path: "/torneos",
  tags: ["TorneosDeAmigos"],
  request: { query: listQuery },
  responses: {
    200: { description: "Lista de torneos de amigos", content: { "application/json": { schema: z.array(torneoPayload) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/torneos",
  tags: ["TorneosDeAmigos"],
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createTorneoBody } } } },
  responses: {
    201: { description: "Torneo creado", content: { "application/json": { schema: torneoPayload } } },
    400: { description: "Datos invalidos", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/torneos/{id}",
  tags: ["TorneosDeAmigos"],
  request: { params: idParam },
  responses: {
    200: { description: "Torneo", content: { "application/json": { schema: torneoPayload } } },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/torneos/{id}/unirse",
  tags: ["TorneosDeAmigos"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: "Ya era miembro", content: { "application/json": { schema: torneoPayload.extend({ yaEraMiembro: z.boolean() }) } } },
    201: { description: "Se unio al torneo", content: { "application/json": { schema: torneoPayload.extend({ yaEraMiembro: z.boolean() }) } } },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/torneos/{id}/tabla",
  tags: ["TorneosDeAmigos"],
  request: { params: idParam },
  responses: {
    200: { description: "Tabla del torneo", content: { "application/json": { schema: z.array(tablaEntryPayload) } } },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/torneos/{id}/mis-predicciones",
  tags: ["TorneosDeAmigos"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: "Predicciones del usuario para este torneo", content: { "application/json": { schema: z.array(prediccionPayload) } } },
    401: { description: "No autenticado", content: { "application/json": { schema: errorResponse } } },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/torneos/{id}/invitaciones",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: crearInvitacionBody } } },
  },
  responses: {
    201: { description: "Invitacion creada", content: { "application/json": { schema: invitacionPayload } } },
    403: { description: "No sos creador del torneo", content: { "application/json": { schema: errorResponse } } },
    404: { description: "Usuario o torneo no encontrado", content: { "application/json": { schema: errorResponse } } },
    409: { description: "El usuario ya es miembro", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/torneos/{id}/invitaciones",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: "Invitaciones del torneo", content: { "application/json": { schema: z.array(invitacionPayload) } } },
    403: { description: "No sos creador", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/torneos/{id}/invite-link",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: "Token actual (null si no hay)", content: { "application/json": { schema: inviteLinkPayload } } },
    403: { description: "No sos creador", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/torneos/{id}/invite-link",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    201: { description: "Token generado / rotado", content: { "application/json": { schema: inviteLinkPayload } } },
    403: { description: "No sos creador", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/torneos/{id}/invite-link",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: "Token revocado", content: { "application/json": { schema: inviteLinkPayload } } },
    403: { description: "No sos creador", content: { "application/json": { schema: errorResponse } } },
  },
});

module.exports = router;
