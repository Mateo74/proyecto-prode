const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");

async function list() {
  return prisma.competencia.findMany({
    where: { visible: true },
    orderBy: { nombre: "asc" },
  });
}

async function getById(id) {
  const competencia = await prisma.competencia.findUnique({ where: { id } });
  if (!competencia) throw httpError(404, "Competencia no encontrada");
  return competencia;
}

module.exports = { getById, list };
