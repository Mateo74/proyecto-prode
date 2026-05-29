const { Router } = require("express");
const swaggerUi = require("swagger-ui-express");

const authRoutes = require("./auth.routes");
const usuariosRoutes = require("./usuarios.routes");
const competenciasRoutes = require("./competencias.routes");
const torneosRoutes = require("./torneos.routes");
const equiposRoutes = require("./equipos.routes");
const partidosRoutes = require("./partidos.routes");
const prediccionesRoutes = require("./predicciones.routes");
const invitacionesRoutes = require("./invitaciones.routes");
const invitesRoutes = require("./invites.routes");

const { buildSpec } = require("../openapi/spec");
const env = require("../config/env");

const router = Router();

router.get("/health", (req, res) => res.json({ ok: true }));

router.use("/auth", authRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/competencias", competenciasRoutes);
router.use("/torneos", torneosRoutes);
router.use("/equipos", equiposRoutes);
router.use("/partidos", partidosRoutes);
router.use("/predicciones", prediccionesRoutes);
router.use("/invitaciones", invitacionesRoutes);
router.use("/invites", invitesRoutes);

// Only expose API docs in non-production environments
if (env.NODE_ENV !== "production") {
  router.get("/openapi.json", (req, res) => res.json(buildSpec()));
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(undefined, { swaggerOptions: { url: "/api/openapi.json" } }));
}

module.exports = router;
