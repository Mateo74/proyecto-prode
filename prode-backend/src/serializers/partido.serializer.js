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
  // Lock purely at the scheduled start time — the API estado can lag
  // behind reality (still "PROGRAMADO" minutes after kick-off), so we
  // never rely on it for the cutoff; we only use partido.fecha.
  const prediccionEditable = Boolean(
    new Date() < new Date(partido.fecha),
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
    equipo1Id: partido.equipo1Id,
    equipo1: partido.equipo1.nombre,
    equipo1NombreEn: partido.equipo1.nombreEn ?? null,
    equipo1NombreCompleto: partido.equipo1.nombreCompleto,
    equipo1Tipo: partido.equipo1.tipo,
    equipo1EscudoUrl: partido.equipo1.escudoUrl,
    equipo2Id: partido.equipo2Id,
    equipo2: partido.equipo2.nombre,
    equipo2NombreEn: partido.equipo2.nombreEn ?? null,
    equipo2NombreCompleto: partido.equipo2.nombreCompleto,
    equipo2Tipo: partido.equipo2.tipo,
    equipo2EscudoUrl: partido.equipo2.escudoUrl,
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
