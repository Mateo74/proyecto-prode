const { prisma } = require("../config/prisma");
const { Expo } = require("expo-server-sdk");
const { httpError } = require("../utils/httpError");

async function registerToken(req, res) {
  const { token } = req.body;
  if (!token || !Expo.isExpoPushToken(token)) {
    throw httpError(400, "token inválido: debe ser un Expo push token");
  }

  await prisma.expoToken.upsert({
    where: { usuarioId_token: { usuarioId: req.usuario.id, token } },
    update: {},
    create: { usuarioId: req.usuario.id, token },
  });

  res.status(201).json({ ok: true });
}

async function unregisterToken(req, res) {
  const { token } = req.body;
  if (!token) throw httpError(400, "token requerido");

  await prisma.expoToken.deleteMany({
    where: { usuarioId: req.usuario.id, token },
  });

  res.json({ ok: true });
}

module.exports = { registerToken, unregisterToken };
