const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");
const { calcularPuntos } = require("./scoring.service");
const { includePartido } = require("./includes");

const ESTADO_FRONT_TO_DB = {
  proximo: ["FUTURO", "PROGRAMADO"],
  "en-vivo": ["EN_JUEGO"],
  finalizado: ["TERMINADO"],
  suspendido: ["SUSPENDIDO"],
  cancelado: ["CANCELADO"],
};

const LIGA_SLUG = {
  champions: "champions-league",
  laliga: "la-liga",
  premier: "premier-league",
  seriea: "serie-a",
  bundesliga: "bundesliga",
  libertadores: "copa-libertadores",
};

function buildWhere({ estado, liga, competenciaId } = {}) {
  const where = {};

  if (estado) {
    const dbEstados = ESTADO_FRONT_TO_DB[estado];
    where.estado = dbEstados ? { in: dbEstados } : estado;
  }

  if (competenciaId) {
    where.competenciaId = competenciaId;
  } else if (liga) {
    const slug = LIGA_SLUG[liga] || liga;
    where.competencia = {
      OR: [
        { slug },
        { nombre: { contains: liga, mode: "insensitive" } },
      ],
    };
  }

  return where;
}

async function list({ filters = {}, usuarioId } = {}) {
  return prisma.partido.findMany({
    where: buildWhere(filters),
    include: {
      ...includePartido,
      predicciones: usuarioId
        ? { where: { usuarioId }, take: 1 }
        : false,
    },
    orderBy: { fecha: "asc" },
  });
}

async function getById(id, { usuarioId } = {}) {
  const partido = await prisma.partido.findUnique({
    where: { id },
    include: {
      ...includePartido,
      predicciones: usuarioId
        ? { where: { usuarioId }, take: 1 }
        : false,
    },
  });
  if (!partido) throw httpError(404, "Partido no encontrado");
  return partido;
}

function pickGoles(body) {
  const golesEquipo1 = body.golesEquipo1 ?? body.golesLocal;
  const golesEquipo2 = body.golesEquipo2 ?? body.golesVisitante;
  return { golesEquipo1, golesEquipo2 };
}

async function cerrar(partidoId, body) {
  const { golesEquipo1, golesEquipo2 } = pickGoles(body);

  return prisma.$transaction(async (tx) => {
    const partido = await tx.partido.findUnique({
      where: { id: partidoId },
      include: includePartido,
    });

    if (!partido) throw httpError(404, "Partido no encontrado");

    if (partido.estado === "TERMINADO" && partido.resultadoConfirmado) {
      const mismoResultado =
        partido.golesEquipo1 === golesEquipo1 &&
        partido.golesEquipo2 === golesEquipo2;

      if (!mismoResultado) {
        throw httpError(409, "El partido ya fue cerrado con otro resultado");
      }

      return { partido, prediccionesActualizadas: 0, yaEstabaCerrado: true };
    }

    const update = await tx.partido.updateMany({
      where: { id: partidoId },
      data: {
        estado: "TERMINADO",
        golesEquipo1,
        golesEquipo2,
        minutoActual: null,
        fechaInicioReal: partido.fechaInicioReal || partido.fecha,
        ultimaActualizacionEstado: new Date(),
        resultadoConfirmado: true,
        confirmacionesResultado: 2,
      },
    });

    if (update.count === 0) {
      throw httpError(409, "El partido ya fue cerrado por otra operacion");
    }

    const partidoCerrado = await tx.partido.findUnique({
      where: { id: partidoId },
      include: { ...includePartido, predicciones: true },
    });

    for (const prediccion of partidoCerrado.predicciones) {
      await tx.prediccion.update({
        where: { id: prediccion.id },
        data: {
          puntosOtorgados: calcularPuntos({
            golesEquipo1Predicho: prediccion.golesEquipo1Predicho,
            golesEquipo2Predicho: prediccion.golesEquipo2Predicho,
            golesEquipo1Real: golesEquipo1,
            golesEquipo2Real: golesEquipo2,
          }),
        },
      });
    }

    return {
      partido: partidoCerrado,
      prediccionesActualizadas: partidoCerrado.predicciones.length,
      yaEstabaCerrado: false,
    };
  });
}

module.exports = { cerrar, getById, list };
