const { Router } = require("express");
const { registry, z } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { errorResponse } = require("../schemas/common.schema");
const { inviteTokenParam } = require("../schemas/invitaciones.schema");
const { torneoPayload } = require("../schemas/torneos.schema");
const controller = require("../controllers/torneos.controller");

const { Router } = require("express");
const { registry, z } = require("../openapi/registry");
const { asyncRoute } = require("../utils/asyncRoute");
const { validate } = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { errorResponse } = require("../schemas/common.schema");
const { inviteTokenParam } = require("../schemas/invitaciones.schema");
const { torneoPayload } = require("../schemas/torneos.schema");
const controller = require("../controllers/torneos.controller");
const env = require("../config/env");

const router = Router();

router.get(
  "/:token/og-preview",
  validate({ params: inviteTokenParam }),
  asyncRoute(async (req, res) => {
    const token = req.params.token;
    const lang = (req.query.lang === 'en') ? 'en' : 'es';
    let torneo;
    try {
      torneo = await require("../services/torneos.service").getByInviteToken(token);
    } catch {
      return res.redirect(`${env.FRONTEND_BASE_URL}/pages/invitacion.html?token=${encodeURIComponent(token)}`);
    }
    const torneoNombre = torneo.nombre || 'Once Metros';
    const compNombre = lang === 'en'
      ? (torneo.competencia?.nombreEn || torneo.competencia?.nombre || 'Football')
      : (torneo.competencia?.nombre || 'Fútbol');
    const title = lang === 'en'
      ? `Join "${torneoNombre}" | Once Metros`
      : `Te invitan a "${torneoNombre}" | Once Metros`;
    const description = lang === 'en'
      ? `${compNombre}: Predict results and compete with your friends.`
      : `${compNombre}: Predecí resultados y competí con tus amigos.`;
    const redirectUrl = `${env.FRONTEND_BASE_URL}/pages/invitacion.html?token=${encodeURIComponent(token)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Once Metros">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="https://www.oncemetros.com/assets/cancha.jpg">
<meta property="og:url" content="${redirectUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="https://www.oncemetros.com/assets/cancha.jpg">
<meta http-equiv="refresh" content="0;url=${redirectUrl}">
</head><body><script>window.location.replace(${JSON.stringify(redirectUrl)});</script></body></html>`);
  }),
);

router.get(
  "/:token",
  validate({ params: inviteTokenParam }),
  asyncRoute(controller.getByInviteToken),
);
router.post(
  "/:token/aceptar",
  requireAuth,
  validate({ params: inviteTokenParam }),
  asyncRoute(controller.joinByInviteToken),
);

registry.registerPath({
  method: "get",
  path: "/invites/{token}",
  tags: ["Invitaciones"],
  request: { params: inviteTokenParam },
  responses: {
    200: { description: "Preview del torneo del invite link", content: { "application/json": { schema: torneoPayload } } },
    404: { description: "Invite invalido o revocado", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/invites/{token}/aceptar",
  tags: ["Invitaciones"],
  security: [{ bearerAuth: [] }],
  request: { params: inviteTokenParam },
  responses: {
    200: { description: "Ya era miembro", content: { "application/json": { schema: torneoPayload.extend({ yaEraMiembro: z.boolean() }) } } },
    201: { description: "Se unio al torneo", content: { "application/json": { schema: torneoPayload.extend({ yaEraMiembro: z.boolean() }) } } },
    404: { description: "Invite invalido", content: { "application/json": { schema: errorResponse } } },
  },
});

module.exports = router;
