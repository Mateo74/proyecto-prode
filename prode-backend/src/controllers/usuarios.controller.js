const usuariosService = require("../services/usuarios.service");
const { usuarioPublico, usuarioResponse } = require("../serializers/usuario.serializer");
const { httpError } = require("../utils/httpError");

async function getById(req, res) {
  const usuario = await usuariosService.getById(req.params.id);
  const esPropio = req.usuario && req.usuario.id === usuario.id;
  res.json(esPropio ? usuarioResponse(usuario) : usuarioPublico(usuario));
}

async function update(req, res) {
  if (req.usuario.id !== req.params.id && req.usuario.rol !== "ADMIN") {
    throw httpError(403, "Solo podes editar tu propio perfil");
  }
  const usuario = await usuariosService.update(req.params.id, req.body);
  res.json(usuarioResponse(usuario));
}

async function deleteById(req, res) {
  if (req.usuario.id !== req.params.id && req.usuario.rol !== "ADMIN") {
    throw httpError(403, "Solo podes eliminar tu propia cuenta");
  }
  await usuariosService.deleteById(req.params.id);
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.status(204).end();
}

module.exports = { getById, update, deleteById };
