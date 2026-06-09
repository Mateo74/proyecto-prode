const { Router } = require("express");
const { asyncRoute } = require("../utils/asyncRoute");
const { requireAuth } = require("../middlewares/auth.middleware");
const controller = require("../controllers/push.controller");

const router = Router();

router.post("/register", requireAuth, asyncRoute(controller.registerToken));
router.post("/unregister", requireAuth, asyncRoute(controller.unregisterToken));

module.exports = router;
