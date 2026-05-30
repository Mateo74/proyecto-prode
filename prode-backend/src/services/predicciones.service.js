const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");
const { includePartido } = require("./includes");

const PARTIDO_INCLUDE = { partido: { include: includePartido } };

function pickScores(body) {
  const scoreEquipo1 = body.scoreEquipo1 ?? body.scoreLocal;
  const scoreEquipo2 = body.scoreEquipo2 ?? body.scoreVisitante;
  if (scoreEquipo1 === undefined || scoreEquipo2 === undefined) {
    throw httpError(400, "Faltan los goles del equipo 1 o del equipo 2");
  }
  return { golesEquipo1Predicho: scoreEquipo1, golesEquipo2Predicho: scoreEquipo2 };
}

function assertEditable(partido) {
  const now = new Date();
  const inicio = partido.fechaInicioReal || partido.fecha;

  if (partido.estado !== "FUTURO" && partido.estado !== "PROGRAMADO") {
    throw httpError(409, "No se puede modificar la predicción de un partido que ya empezó");
  }

  if (inicio && now >= inicio) {
    throw httpError(409, "No se puede modificar la predicción después del inicio del partido");
  }
}

async function upsertForUser(usuarioId, body) {
  const partidoId = body.matchId;
  const goles = pickScores(body);

  return prisma.$transaction(async (tx) => {
    const partido = await tx.partido.findUnique({
      where: { id: partidoId },
      include: includePartido,
    });
    if (!partido) throw httpError(404, "Partido no encontrado");
    assertEditable(partido);

    const prediccion = await tx.prediccion.upsert({
      where: { partidoId_usuarioId: { partidoId, usuarioId } },
      create: { partidoId, usuarioId, ...goles },
      update: goles,
      include: PARTIDO_INCLUDE,
    });

    return prediccion;
  });
}

async function updateById(prediccionId, usuarioId, body) {
  const goles = pickScores(body);

  return prisma.$transaction(async (tx) => {
    const prediccion = await tx.prediccion.findUnique({
      where: { id: prediccionId },
      include: PARTIDO_INCLUDE,
    });
    if (!prediccion) throw httpError(404, "Prediccion no encontrada");
    if (prediccion.usuarioId !== usuarioId) {
      throw httpError(403, "Esa prediccion no es tuya");
    }
    assertEditable(prediccion.partido);

    return tx.prediccion.update({
      where: { id: prediccionId },
      data: goles,
      include: PARTIDO_INCLUDE,
    });
  });
}

async function listByTorneoForUser(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    select: { competenciaId: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");

  return prisma.prediccion.findMany({
    where: {
      usuarioId,
      partido: { competenciaId: torneo.competenciaId },
    },
    include: PARTIDO_INCLUDE,
    orderBy: { partido: { fecha: "asc" } },
  });
}

async function listClosedMatchesWithPredictionForUser(torneoId, usuarioId) {
  const torneo = await prisma.torneoDeAmigos.findUnique({
    where: { id: torneoId },
    select: { competenciaId: true },
  });
  if (!torneo) throw httpError(404, "Torneo no encontrado");

  return prisma.partido.findMany({
    where: {
      competenciaId: torneo.competenciaId,
      // Include matches that are finished OR have already started (can no longer predict)
      estado: { in: ["TERMINADO", "EN_JUEGO"] },
    },
    include: {
      ...includePartido,
      predicciones: { where: { usuarioId }, take: 1 },
    },
    orderBy: { fecha: "desc" },
  });
}

module.exports = { listByTorneoForUser, listClosedMatchesWithPredictionForUser, updateById, upsertForUser };
