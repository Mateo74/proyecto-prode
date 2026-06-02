const crypto = require("node:crypto");
const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");
const { esPrediccionExacta } = require("./scoring.service");

const torneoInclude = {
  competencia: true,
  creador: { select: { id: true, nombre: true, apellido: true, username: true } },
  _count: { select: { usuarios: true } },
};

function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

function assertEsCreador(torneo, usuarioId) {
  if (!torneo.creadorId || torneo.creadorId !== usuarioId) {
    throw httpError(403, "Solo el creador del torneo puede hacer esto");
  }
}

async function list({ usuarioId } = {}) {
  return prisma.torneoDeAmigos.findMany({
    where: usuarioId ? { usuarios: { some: { id: usuarioId } } } : undefined,
    include: torneoInclude,
    orderBy: { fechaCreacion: "desc" },
  });
}

async function getById(id) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id },
    include: torneoInclude,
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  return torneo;
}

async function create({ nombre, competenciaId, creadorId }) {
  const competencia = await prisma.competencia.findUnique({ where: { id: competenciaId } });
  if (!competencia) throw httpError(400, "La competencia no existe");

  return prisma.torneoDeAmigos.create({
    data: {
      nombre,
      competenciaId,
      creadorId,
      usuarios: { connect: { id: creadorId } },
    },
    include: torneoInclude,
  });
}

async function update(id, usuarioId, { nombre }) {
  const torneo = await getById(id);
  assertEsCreador(torneo, usuarioId);
  return prisma.torneoDeAmigos.update({
    where: { id },
    data: { nombre },
    include: torneoInclude,
  });
}

async function remove(id, usuarioId) {
  const torneo = await getById(id);
  assertEsCreador(torneo, usuarioId);
  await prisma.torneoDeAmigos.delete({ where: { id } });
}

async function leaveUser(torneoId, usuarioId) {
  const torneo = await getById(torneoId);
  if (torneo.creadorId === usuarioId) {
    const { httpError } = require('../utils/httpError');
    throw httpError(400, 'El creador no puede salir del torneo. Podés eliminarlo.');
  }
  await prisma.torneoDeAmigos.update({
    where: { id: torneoId },
    data: { usuarios: { disconnect: { id: usuarioId } } },
  });
}

async function joinUser(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    include: { usuarios: { where: { id: usuarioId }, select: { id: true } } },
  });

  if (!torneo) throw httpError(404, "Torneo no encontrado");
  if (!torneo.activo) throw httpError(409, "El torneo esta inactivo");

  const yaEra = torneo.usuarios.length > 0;

  if (!yaEra) {
    await prisma.torneoDeAmigos.update({
      where: { id: torneoId },
      data: { usuarios: { connect: { id: usuarioId } } },
    });
  }

  const torneoFinal = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    include: torneoInclude,
  });

  return { torneo: torneoFinal, yaEraMiembro: yaEra };
}

async function getTabla(torneoId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    include: {
      usuarios: { include: { hinchaDe: true } },
    },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  if (torneo.usuarios.length === 0) return [];

  const usuarioIds = torneo.usuarios.map((u) => u.id);

  const predicciones = await prisma.prediccion.findMany({
    where: {
      usuarioId: { in: usuarioIds },
      partido: {
        competenciaId: torneo.competenciaId,
        estado: "TERMINADO",
        // Only count matches that were played after this torneo was created,
        // so all participants compete on an even footing from day one.
        fecha: { gte: torneo.fechaCreacion },
      },
      puntosOtorgados: { not: null },
    },
    include: { partido: true },
  });

  const totales = new Map(
    usuarioIds.map((id) => [id, { puntos: 0, aciertos: 0, exactos: 0 }]),
  );

  for (const prediccion of predicciones) {
    const acc = totales.get(prediccion.usuarioId);
    if (!acc) continue;
    acc.puntos += prediccion.puntosOtorgados;
    if (prediccion.puntosOtorgados > 0) acc.aciertos += 1;
    if (esPrediccionExacta(prediccion)) acc.exactos += 1;
  }

  return torneo.usuarios
    .map((usuario) => ({
      usuarioId: usuario.id,
      usuario,
      ...totales.get(usuario.id),
    }))
    .sort((a, b) =>
      b.puntos - a.puntos ||
      b.aciertos - a.aciertos ||
      b.exactos - a.exactos ||
      a.usuario.username.localeCompare(b.usuario.username),
    );
}

async function getInviteToken(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    select: { id: true, creadorId: true, inviteToken: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  assertEsCreador(torneo, usuarioId);
  return torneo.inviteToken;
}

async function rotateInviteToken(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    select: { id: true, creadorId: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  assertEsCreador(torneo, usuarioId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateToken();
    try {
      const updated = await prisma.torneoDeAmigos.update({
        where: { id: torneoId },
        data: { inviteToken: token },
        select: { inviteToken: true },
      });
      return updated.inviteToken;
    } catch (err) {
      if (err.code !== "P2002") throw err;
    }
  }
  throw httpError(500, "No se pudo generar el invite token");
}

async function revokeInviteToken(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    select: { id: true, creadorId: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  assertEsCreador(torneo, usuarioId);
  await prisma.torneoDeAmigos.update({
    where: { id: torneoId },
    data: { inviteToken: null },
  });
}

async function getByInviteToken(token) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { inviteToken: token },
    include: torneoInclude,
  });
  if (!torneo) throw httpError(404, "Invitacion invalida o revocada");
  return torneo;
}

async function joinByInviteToken(token, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { inviteToken: token },
    select: { id: true, activo: true },
  });
  if (!torneo) throw httpError(404, "Invitacion invalida o revocada");
  return joinUser(torneo.id, usuarioId);
}

module.exports = {
  assertEsCreador,
  create,
  getById,
  getByInviteToken,
  getInviteToken,
  getTabla,
  joinByInviteToken,
  joinUser,
  leaveUser,
  list,
  remove,
  revokeInviteToken,
  rotateInviteToken,
  update,
};
