const { estadoPrediccion } = require("./partido.serializer");

function prediccionResponse(prediccion) {
  const partido = prediccion.partido;
  const equipo1 = partido.equipo1;
  const equipo2 = partido.equipo2;
  const exacto = Boolean(
    partido.golesEquipo1 != null &&
    partido.golesEquipo2 != null &&
    prediccion.golesEquipo1Predicho === partido.golesEquipo1 &&
    prediccion.golesEquipo2Predicho === partido.golesEquipo2,
  );

  return {
    id: prediccion.id,
    matchId: prediccion.partidoId,
    equipo1Id: partido.equipo1Id,
    equipo1: equipo1?.nombre ?? null,
    equipo1NombreEn: equipo1?.nombreEn ?? null,
    equipo1NombreCompleto: equipo1?.nombreCompleto ?? null,
    equipo1Tipo: equipo1?.tipo ?? null,
    equipo2Id: partido.equipo2Id,
    equipo2: equipo2?.nombre ?? null,
    equipo2NombreEn: equipo2?.nombreEn ?? null,
    equipo2NombreCompleto: equipo2?.nombreCompleto ?? null,
    equipo2Tipo: equipo2?.tipo ?? null,
    liga: partido.competencia?.nombre,
    ligaEn: partido.competencia?.nombreEn ?? null,
    competenciaId: partido.competenciaId,
    fecha: partido.fecha,
    scoreEquipo1Pred: prediccion.golesEquipo1Predicho,
    scoreEquipo2Pred: prediccion.golesEquipo2Predicho,
    scoreEquipo1: partido.golesEquipo1,
    scoreEquipo2: partido.golesEquipo2,
    estado: estadoPrediccion(prediccion),
    puntos: prediccion.puntosOtorgados || 0,
    exacto,
  };
}

module.exports = { prediccionResponse };
