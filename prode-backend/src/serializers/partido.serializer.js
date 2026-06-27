const ESTADO_FRONTEND = {
  FUTURO: "proximo",
  PROGRAMADO: "proximo",
  EN_JUEGO: "en-vivo",
  TERMINADO: "finalizado",
  SUSPENDIDO: "suspendido",
  CANCELADO: "cancelado",
};

function estadoParaFrontend(estado) {
  return ESTADO_FRONTEND[estado] || "proximo";
}

function estadoPrediccion(prediccion) {
  if (prediccion.puntosOtorgados == null) return "pendiente";
  return prediccion.puntosOtorgados > 0 ? "acierto" : "fallo";
}

function partidoResponse(partido, userPrediccion) {
  const pred = userPrediccion || partido.predicciones?.[0];
  const equipo1 = partido.equipo1;
  const equipo2 = partido.equipo2;
  const equiposDefinidos = Boolean(partido.equipo1Id && partido.equipo2Id);
  // Lock purely at the scheduled start time — the API estado can lag
  // behind reality (still "PROGRAMADO" minutes after kick-off), so we
  // never rely on it for the cutoff; we only use partido.fecha.
  // Knockout fixtures without both teams decided yet can't be predicted.
  const prediccionEditable = Boolean(
    equiposDefinidos && new Date() < new Date(partido.fecha),
  );
  const exacto = Boolean(
    pred &&
    partido.golesEquipo1 != null &&
    partido.golesEquipo2 != null &&
    pred.golesEquipo1Predicho === partido.golesEquipo1 &&
    pred.golesEquipo2Predicho === partido.golesEquipo2,
  );

  return {
    id: partido.id,
    competenciaId: partido.competenciaId,
    liga: partido.competencia?.nombre,
    ligaEn: partido.competencia?.nombreEn ?? null,
    competencia: partido.competencia
      ? { id: partido.competencia.id, nombre: partido.competencia.nombre, nombreEn: partido.competencia.nombreEn ?? null, slug: partido.competencia.slug }
      : null,
    etapa: partido.etapa ?? null,
    equipo1Id: partido.equipo1Id,
    equipo1: equipo1?.nombre ?? null,
    equipo1NombreEn: equipo1?.nombreEn ?? null,
    equipo1NombreCompleto: equipo1?.nombreCompleto ?? null,
    equipo1Tipo: equipo1?.tipo ?? null,
    equipo1EscudoUrl: equipo1?.escudoUrl ?? null,
    equipo2Id: partido.equipo2Id,
    equipo2: equipo2?.nombre ?? null,
    equipo2NombreEn: equipo2?.nombreEn ?? null,
    equipo2NombreCompleto: equipo2?.nombreCompleto ?? null,
    equipo2Tipo: equipo2?.tipo ?? null,
    equipo2EscudoUrl: equipo2?.escudoUrl ?? null,
    equipo1EsLocal: partido.equipo1EsLocal,
    estado: estadoParaFrontend(partido.estado),
    estadoRaw: partido.estado,
    scoreEquipo1: partido.golesEquipo1,
    scoreEquipo2: partido.golesEquipo2,
    minutoActual: partido.minutoActual,
    relojFase: partido.relojFase,
    fechaInicioReal: partido.fechaInicioReal,
    ultimaSyncExterna: partido.ultimaSyncExterna,
    ultimaActualizacion: partido.ultimaActualizacionEstado || partido.fechaActualizacion,
    resultadoConfirmado: partido.resultadoConfirmado,
    prediccionEditable,
    fecha: partido.fecha,
    userPred: pred
      ? {
          id: pred.id,
          scoreEquipo1: pred.golesEquipo1Predicho,
          scoreEquipo2: pred.golesEquipo2Predicho,
          estado: estadoPrediccion(pred),
          puntos: pred.puntosOtorgados || 0,
          exacto,
        }
      : null,
  };
}

module.exports = { estadoParaFrontend, estadoPrediccion, partidoResponse };
