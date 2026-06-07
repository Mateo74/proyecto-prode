const torneosService = require("../services/torneos.service");
const prediccionesService = require("../services/predicciones.service");
const invitacionesService = require("../services/invitaciones.service");
const { httpError } = require("../utils/httpError");
const {
  tablaEntryResponse,
  torneoDeAmigosResponse,
} = require("../serializers/torneoDeAmigos.serializer");
const { prediccionResponse } = require("../serializers/prediccion.serializer");
const { partidoResponse } = require("../serializers/partido.serializer");
const { invitacionResponse } = require("../serializers/invitacion.serializer");
const { usuarioPublico } = require("../serializers/usuario.serializer");

function torneoToJson(torneo) {
  return torneoDeAmigosResponse(torneo, { miembrosCount: torneo._count?.usuarios });
}

async function list(req, res) {
  if (req.query.mias === "true" && !req.usuario) {
    throw httpError(401, "Tenés que iniciar sesión para ver tus torneos");
  }
  const usuarioId = req.query.mias === "true" ? req.usuario.id : undefined;
  const competenciaId = req.query.competenciaId || undefined;
  const torneos = await torneosService.list({ usuarioId, competenciaId });
  const hasGlobal = torneos.some(t => t.esGlobal);
  const totalActivos = hasGlobal ? await torneosService.countActiveUsers() : 0;
  res.json(torneos.map(t => torneoDeAmigosResponse(t, {
    miembrosCount: t.esGlobal ? totalActivos : (t._count?.usuarios ?? 0),
  })));
}

async function getById(req, res) {
  const torneo = await torneosService.getById(req.params.id);
  res.json(torneoToJson(torneo));
}

async function create(req, res) {
  const torneo = await torneosService.create({
    nombre: req.body.nombre,
    competenciaId: req.body.competenciaId,
    creadorId: req.usuario.id,
  });
  res.status(201).json(torneoToJson(torneo));
}

async function unirse(req, res) {
  const { torneo, yaEraMiembro } = await torneosService.joinUser(
    req.params.id,
    req.usuario.id,
  );
  res.status(yaEraMiembro ? 200 : 201).json({
    ...torneoToJson(torneo),
    yaEraMiembro,
  });
}

async function getTabla(req, res) {
  const puntajes = await torneosService.getTabla(req.params.id);
  res.json(puntajes.map(tablaEntryResponse));
}

async function getMisPredicciones(req, res) {
  const predicciones = await prediccionesService.listByTorneoForUser(
    req.params.id,
    req.usuario.id,
  );
  res.json(predicciones.map(prediccionResponse));
}

async function getPrediccionesDeUsuario(req, res) {
  const partidos = await prediccionesService.listClosedMatchesWithPredictionForUser(
    req.params.id,
    req.params.usuarioId,
  );
  res.json(partidos.map(p => partidoResponse(p)));
}

async function invitarUsuario(req, res) {
  const invitacion = await invitacionesService.crearInvitacion({
    torneoId: req.params.id,
    invitadoPorId: req.usuario.id,
    identificador: req.body.identificador,
  });
  res.status(201).json(invitacionResponse(invitacion));
}

async function listarInvitacionesDelTorneo(req, res) {
  const invitaciones = await invitacionesService.listarParaTorneo(req.params.id, req.usuario.id);
  res.json(invitaciones.map(invitacionResponse));
}

async function getInviteLink(req, res) {
  const token = await torneosService.getInviteToken(req.params.id, req.usuario.id);
  res.json({ token });
}

async function rotateInviteLink(req, res) {
  const token = await torneosService.rotateInviteToken(req.params.id, req.usuario.id);
  res.status(201).json({ token });
}

async function revokeInviteLink(req, res) {
  await torneosService.revokeInviteToken(req.params.id, req.usuario.id);
  res.json({ token: null });
}

async function getByInviteToken(req, res) {
  const torneo = await torneosService.getByInviteToken(req.params.token);
  res.json(torneoToJson(torneo));
}

async function joinByInviteToken(req, res) {
  const { torneo, yaEraMiembro } = await torneosService.joinByInviteToken(
    req.params.token,
    req.usuario.id,
  );
  res.status(yaEraMiembro ? 200 : 201).json({
    ...torneoToJson(torneo),
    yaEraMiembro,
  });
}

async function update(req, res) {
  const torneo = await torneosService.update(req.params.id, req.usuario.id, { nombre: req.body.nombre });
  res.json(torneoToJson(torneo));
}

async function remove(req, res) {
  await torneosService.remove(req.params.id, req.usuario.id);
  res.status(204).end();
}

async function leaveUser(req, res) {
  await torneosService.leaveUser(req.params.id, req.usuario.id);
  res.status(204).end();
}

async function getMatchPredicciones(req, res) {
  const { id: torneoId, partidoId } = req.params;
  const usuarioId = req.usuario?.id;
  const { torneo, partido, userPrediccion, entries } = await torneosService.getMatchPredictions(torneoId, partidoId, usuarioId);
  res.json({
    torneo: torneoDeAmigosResponse(torneo),
    partido: partidoResponse(partido, userPrediccion),
    entries: entries.map(e => ({
      usuario: usuarioPublico(e.usuario),
      prediccion: e.prediccion
        ? {
            golesEquipo1: e.prediccion.golesEquipo1Predicho,
            golesEquipo2: e.prediccion.golesEquipo2Predicho,
            puntos: e.prediccion.puntosOtorgados ?? null,
          }
        : null,
    })),
  });
}

module.exports = {
  create,
  getById,
  getByInviteToken,
  getInviteLink,
  getMatchPredicciones,
  getMisPredicciones,
  getPrediccionesDeUsuario,
  getTabla,
  invitarUsuario,
  joinByInviteToken,
  leaveUser,
  list,
  listarInvitacionesDelTorneo,
  remove,
  revokeInviteLink,
  rotateInviteLink,
  unirse,
  update,
};
