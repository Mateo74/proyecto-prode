const { prisma } = require("../config/prisma");
const { httpError } = require("../utils/httpError");
const { includeUsuario } = require("./includes");

async function getById(id) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: includeUsuario,
  });

  if (!usuario) throw httpError(404, "Usuario no encontrado");

  return usuario;
}

async function deleteById(id) {
  // Null out creadorId on owned torneos so they persist for other members
  await prisma.torneoDeAmigos.updateMany({ where: { creadorId: id }, data: { creadorId: null } });
  // Disconnect from all torneos (many-to-many join table)
  await prisma.usuario.update({ where: { id }, data: { torneosDeAmigos: { set: [] } } });
  // Predicciones, RefreshTokens, and Invitaciones have onDelete: Cascade in schema
  await prisma.usuario.delete({ where: { id } });
}

async function update(id, data) {
  if (data.hinchaDeEquipoId === null) {
    data = { ...data, hinchaDeEquipoId: null };
  } else if (data.hinchaDeEquipoId) {
    const equipo = await prisma.equipo.findUnique({ where: { id: data.hinchaDeEquipoId } });
    if (!equipo) throw httpError(400, "El equipo del que sos hincha no existe");
  }

  try {
    return await prisma.usuario.update({
      where: { id },
      data,
      include: includeUsuario,
    });
  } catch (err) {
    if (err.code === "P2025") throw httpError(404, "Usuario no encontrado");
    throw err;
  }
}

module.exports = { deleteById, getById, update };
