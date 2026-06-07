const crypto = require("node:crypto");
const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");
const { esPrediccionExacta } = require("./scoring.service");
const { includePartido } = require("./includes");

const torneoInclude = {
  competencia: true,
  creador: { select: { id: true, nombre: true, apellido: true, username: true } },
  usuarios: { select: { id: true } },
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

async function list({ usuarioId, competenciaId } = {}) {
  // Always include global torneos (implicit membership for everyone).
  // If a userId is provided, also include torneos the user explicitly joined.
  // If a competenciaId is provided, restrict results to that competencia.
  const visibleOnly = { competencia: { visible: true } };
  const competenciaFilter = competenciaId
    ? { competenciaId, ...visibleOnly }
    : visibleOnly;
  const where = usuarioId
    ? { OR: [{ esGlobal: true, ...competenciaFilter }, { usuarios: { some: { id: usuarioId } }, ...competenciaFilter }] }
    : competenciaFilter;
  return prisma.torneoDeAmigos.findMany({
    where,
    include: torneoInclude,
    // Global torneos pinned first, then most recently created
    orderBy: [{ esGlobal: "desc" }, { fechaCreacion: "desc" }],
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

function assertNotGlobal(torneo) {
  if (torneo.esGlobal) throw httpError(403, "No se puede modificar un torneo global");
}

async function update(id, usuarioId, { nombre }) {
  const torneo = await getById(id);
  assertNotGlobal(torneo);
  assertEsCreador(torneo, usuarioId);
  return prisma.torneoDeAmigos.update({
    where: { id },
    data: { nombre },
    include: torneoInclude,
  });
}

async function remove(id, usuarioId) {
  const torneo = await getById(id);
  assertNotGlobal(torneo);
  assertEsCreador(torneo, usuarioId);
  await prisma.torneoDeAmigos.delete({ where: { id } });
}

async function leaveUser(torneoId, usuarioId) {
  const torneo = await getById(torneoId);
  assertNotGlobal(torneo);
  if (torneo.creadorId === usuarioId) {
    throw httpError(400, "El creador no puede salir del torneo. Podés eliminarlo.");
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

  // Global torneos have implicit membership — nothing to write to the DB.
  if (torneo.esGlobal) {
    const torneoFinal = await prisma.torneoDeAmigos.findUnique({ where: { id: torneoId }, include: torneoInclude });
    return { torneo: torneoFinal, yaEraMiembro: true };
  }

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

  // For global torneos, use ALL active users as implicit members and score
  // from the very beginning of the competition (no creation-date cutoff).
  let usuarios = torneo.usuarios;
  if (torneo.esGlobal) {
    usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      include: { hinchaDe: true },
    });
  }

  if (usuarios.length === 0) return [];

  const usuarioIds = usuarios.map((u) => u.id);

  const predicciones = await prisma.prediccion.findMany({
    where: {
      usuarioId: { in: usuarioIds },
      partido: {
        competenciaId: torneo.competenciaId,
        estado: "TERMINADO",
        // For regular torneos only: count matches from the torneo creation date
        // so all members compete on even footing. Global torneos have no cutoff.
        ...(torneo.esGlobal ? {} : { fecha: { gte: torneo.fechaCreacion } }),
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

  return usuarios
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
    select: {
      id: true,
      creadorId: true,
      inviteToken: true,
      usuarios: { where: { id: usuarioId }, select: { id: true } },
    },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");
  const isMember =
    torneo.creadorId === usuarioId || torneo.usuarios.length > 0;
  if (!isMember) throw httpError(403, "No sos miembro de este torneo");
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

async function countActiveUsers() {
  return prisma.usuario.count({ where: { activo: true } });
}

async function getMatchPredictions(torneoId, partidoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    include: { ...torneoInclude, usuarios: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");

  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    include: includePartido,
  });
  if (!partido) throw httpError(404, "Partido no encontrado");
  if (partido.competenciaId !== torneo.competenciaId) {
    throw httpError(400, "El partido no pertenece a la competencia del torneo");
  }

  // Fetch the calling user's own prediction so the match card can render it
  let userPrediccion = null;
  if (usuarioId) {
    userPrediccion = await prisma.prediccion.findFirst({
      where: { partidoId, usuarioId },
    });
  }

  if (torneo.esGlobal) {
    // For global torneos: show all users who made a prediction for this match
    const predicciones = await prisma.prediccion.findMany({
      where: { partidoId },
      include: { usuario: { include: { hinchaDe: true } } },
      orderBy: [{ puntosOtorgados: "desc" }],
    });
    return {
      torneo,
      partido,
      userPrediccion,
      entries: predicciones.map(p => ({ usuario: p.usuario, prediccion: p })),
    };
  }

  // Regular torneo: show all members regardless of whether they predicted
  const usuarios = torneo.usuarios;
  if (!usuarios.length) return { torneo, partido, userPrediccion, entries: [] };

  const predicciones = await prisma.prediccion.findMany({
    where: { partidoId, usuarioId: { in: usuarios.map(u => u.id) } },
  });
  const predByUser = new Map(predicciones.map(p => [p.usuarioId, p]));

  return {
    torneo,
    partido,
    userPrediccion,
    entries: usuarios
      .map(u => ({ usuario: u, prediccion: predByUser.get(u.id) ?? null }))
      .sort((a, b) => {
        const pa = a.prediccion?.puntosOtorgados ?? -1;
        const pb = b.prediccion?.puntosOtorgados ?? -1;
        return pb - pa || (a.usuario.username || '').localeCompare(b.usuario.username || '');
      }),
  };
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
  countActiveUsers,
  getByInviteToken,
  getMatchPredictions,
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
