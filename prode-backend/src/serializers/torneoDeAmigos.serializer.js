const { competenciaResponse } = require("./competencia.serializer");
const { usuarioPublico } = require("./usuario.serializer");

function torneoDeAmigosResponse(torneo, { miembrosCount } = {}) {
  return {
    id: torneo.id,
    nombre: torneo.nombre,
    activo: torneo.activo,
    competenciaId: torneo.competenciaId,
    competencia: torneo.competencia ? competenciaResponse(torneo.competencia) : null,
    creadorId: torneo.creadorId ?? null,
    creador: torneo.creador
      ? {
          id: torneo.creador.id,
          nombre: torneo.creador.nombre,
          apellido: torneo.creador.apellido,
          username: torneo.creador.username,
        }
      : null,
    miembrosCount: miembrosCount ?? torneo.usuarios?.length ?? torneo._count?.usuarios ?? null,
    usuarios: torneo.usuarios ? torneo.usuarios.map(u => ({ id: u.id })) : undefined,
    fechaCreacion: torneo.fechaCreacion,
  };
}

function tablaEntryResponse(puntaje) {
  return {
    usuarioId: puntaje.usuarioId,
    usuario: puntaje.usuario ? usuarioPublico(puntaje.usuario) : null,
    puntos: puntaje.puntos,
    aciertos: puntaje.aciertos,
    exactos: puntaje.exactos,
  };
}

module.exports = { tablaEntryResponse, torneoDeAmigosResponse };
