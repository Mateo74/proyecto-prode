const { Router } = require("express");
const { registry, z } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { optionalAuth, requireAuth } = require("../middlewares/auth.middleware");
const { idParam, errorResponse } = require("../schemas/common.schema");
const { updateUsuarioBody } = require("../schemas/usuarios.schema");
const { usuarioPayload } = require("../schemas/auth.schema");
const controller = require("../controllers/usuarios.controller");

const router = Router();

router.get("/:id", optionalAuth, validate({ params: idParam }), asyncRoute(controller.getById));
router.put(
  "/:id",
  requireAuth,
  validate({ params: idParam, body: updateUsuarioBody }),
  asyncRoute(controller.update),
);
router.delete("/:id", requireAuth, validate({ params: idParam }), asyncRoute(controller.deleteById));

const usuarioPublico = z.object({
  id: z.string(),
  nombre: z.string(),
  apellido: z.string().nullable(),
  username: z.string(),
  hinchaDe: z
    .object({
      id: z.string(),
      nombre: z.string(),
      nombreCompleto: z.string().nullable(),
      tipo: z.enum(["CLUB", "SELECCION"]),
    })
    .nullable(),
});

registry.registerPath({
  method: "get",
  path: "/usuarios/{id}",
  tags: ["Usuarios"],
  request: { params: idParam },
  responses: {
    200: {
      description: "Usuario (perfil completo si es propio, publico si es ajeno)",
      content: { "application/json": { schema: z.union([usuarioPayload, usuarioPublico]) } },
    },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/usuarios/{id}",
  tags: ["Usuarios"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: updateUsuarioBody } } },
  },
  responses: {
    200: { description: "Usuario actualizado", content: { "application/json": { schema: usuarioPayload } } },
    403: { description: "No autorizado", content: { "application/json": { schema: errorResponse } } },
    404: { description: "No encontrado", content: { "application/json": { schema: errorResponse } } },
  },
});

module.exports = router;
