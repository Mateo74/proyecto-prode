const { prisma } = require("../config/prisma");
const logger = require("../utils/logger");
const { calcularPuntos } = require("./scoring.service");
const footballDataProvider = require("../providers/footballData.provider");
const { PROVIDER } = require("../providers/footballData.mapper");
const { COMPETITION_ALIASES } = require("./externalCompetitionSync.service");
const { slugify } = require("../utils/slugify");

const TRACKED_COMPETITION_CODES = ["WC", "CL", "BSA"];
const TRACKED_COMPETITIONS = new Set(TRACKED_COMPETITION_CODES);

const CLOCK_PHASE = Object.freeze({
  NOT_STARTED: 0,
  FIRST_HALF: 1,
  HALF_TIME: 2,
  SECOND_HALF: 3,
  END_90_BREAK: 4,
  EXTRA_FIRST_HALF: 5,
  EXTRA_HALF_TIME: 6,
  EXTRA_SECOND_HALF: 7,
  FINISHED: 8,
});

function isLiveExternal(statusExternal) {
  return statusExternal === "LIVE" || statusExternal === "IN_PLAY";
}

function isPausedExternal(statusExternal) {
  return statusExternal === "PAUSED";
}

function minuteFromRunStart(runStart, now) {
  if (!runStart) return null;
  const started = new Date(runStart).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(1, Math.floor((now.getTime() - started) / 60000) + 1);
}

function runStartForBaseMinute(now, baseMinute) {
  return new Date(now.getTime() - (Math.max(1, baseMinute) - 1) * 60000);
}

function computeClockState(existing, dto, now) {
  const prevPhase = existing?.relojFase ?? CLOCK_PHASE.NOT_STARTED;
  const prevMinute = existing?.minutoActual ?? null;
  const prevRunStart = existing?.fechaInicioReal ? new Date(existing.fechaInicioReal) : null;
  const statusExternal = dto.statusExternal;

  if (isLiveExternal(statusExternal)) {
    let phase = prevPhase;
    let runStart = prevRunStart;

    if (prevPhase === CLOCK_PHASE.NOT_STARTED || prevMinute == null) {
      phase = CLOCK_PHASE.FIRST_HALF;
      runStart = runStartForBaseMinute(now, 1);
    } else if (prevPhase === CLOCK_PHASE.HALF_TIME) {
      phase = CLOCK_PHASE.SECOND_HALF;
      runStart = runStartForBaseMinute(now, 46);
    } else if (prevPhase === CLOCK_PHASE.END_90_BREAK) {
      phase = CLOCK_PHASE.EXTRA_FIRST_HALF;
      runStart = runStartForBaseMinute(now, 91);
    } else if (prevPhase === CLOCK_PHASE.EXTRA_HALF_TIME) {
      phase = CLOCK_PHASE.EXTRA_SECOND_HALF;
      runStart = runStartForBaseMinute(now, 106);
    } else if (!runStart) {
      // Safety net: we are live but have no running reference, resume from next minute.
      runStart = runStartForBaseMinute(now, (prevMinute ?? 0) + 1);
    }

    const minute = minuteFromRunStart(runStart, now);
    return { minute, phase, runStart };
  }

  if (isPausedExternal(statusExternal)) {
    const frozenMinute = minuteFromRunStart(prevRunStart, now) ?? prevMinute ?? 45;
    let phase = CLOCK_PHASE.HALF_TIME;

    if (prevPhase === CLOCK_PHASE.EXTRA_FIRST_HALF) {
      phase = CLOCK_PHASE.EXTRA_HALF_TIME;
    } else if (prevPhase === CLOCK_PHASE.EXTRA_SECOND_HALF) {
      // During penalties, many feeds remain PAUSED before FINISHED arrives.
      phase = CLOCK_PHASE.FINISHED;
    } else if (prevPhase === CLOCK_PHASE.SECOND_HALF || frozenMinute >= 90) {
      phase = frozenMinute >= 105 ? CLOCK_PHASE.EXTRA_HALF_TIME : CLOCK_PHASE.END_90_BREAK;
    }

    return { minute: frozenMinute, phase, runStart: null };
  }

  if (statusExternal === "FINISHED") {
    const minute = minuteFromRunStart(prevRunStart, now) ?? prevMinute;
    return { minute, phase: CLOCK_PHASE.FINISHED, runStart: null };
  }

  return { minute: null, phase: CLOCK_PHASE.NOT_STARTED, runStart: null };
}

function isTracked(match) {
  return TRACKED_COMPETITIONS.has(match.competition?.code);
}

function hasUsableMatchData(match) {
  return Boolean(match.externalId && match.utcDate && match.competition && match.homeTeam && match.awayTeam);
}

async function upsertCompetition(tx, dto) {
  const alias = COMPETITION_ALIASES[dto.code];
  const slug = alias?.slug || slugify(dto.code || dto.name || dto.externalId);
  const existing = await tx.competencia.findFirst({
    where: {
      OR: [
        { proveedor: PROVIDER, externalId: dto.externalId },
        { slug },
      ],
    },
  });

  const data = {
    nombre: alias?.nombre || dto.name,
    slug,
    externalId: dto.externalId,
    proveedor: PROVIDER,
    visible: TRACKED_COMPETITIONS.has(dto.code),
  };

  if (existing) {
    return tx.competencia.update({ where: { id: existing.id }, data });
  }

  return tx.competencia.create({ data });
}

async function upsertTeam(tx, dto) {
  const baseSlug = slugify(dto.nombreCompleto || dto.nombre || dto.externalId);
  const existing = await tx.equipo.findFirst({
    where: {
      OR: [
        { proveedor: PROVIDER, externalId: dto.externalId },
        { slug: baseSlug },
      ],
    },
  });

  const data = {
    nombre: dto.nombre,
    nombreCompleto: dto.nombreCompleto,
    tipo: dto.tipo,
    slug: existing?.slug || baseSlug || `${PROVIDER}-${dto.externalId}`,
    abreviatura: dto.abreviatura,
    externalId: dto.externalId,
    proveedor: PROVIDER,
    escudoUrl: dto.escudoUrl,
  };

  if (existing) return tx.equipo.update({ where: { id: existing.id }, data });
  return tx.equipo.create({ data });
}

function didRelevantStateChange(existing, dto, clockState) {
  if (!existing) return true;
  return (
    existing.estado !== dto.status ||
    existing.golesEquipo1 !== dto.scoreHome ||
    existing.golesEquipo2 !== dto.scoreAway ||
    existing.minutoActual !== clockState.minute ||
    (existing.relojFase ?? CLOCK_PHASE.NOT_STARTED) !== clockState.phase
  );
}

function buildResultConfirmation(existing, dto, changed) {
  if (dto.status !== "TERMINADO" || dto.scoreHome == null || dto.scoreAway == null) {
    return { resultadoConfirmado: false, confirmacionesResultado: 0 };
  }

  if (existing?.resultadoConfirmado && !changed) {
    return {
      resultadoConfirmado: true,
      confirmacionesResultado: Math.max(existing.confirmacionesResultado, 2),
    };
  }

  const sameFinishedResult =
    existing?.estado === "TERMINADO" &&
    existing.golesEquipo1 === dto.scoreHome &&
    existing.golesEquipo2 === dto.scoreAway;

  const nextConfirmations = sameFinishedResult
    ? Math.min((existing.confirmacionesResultado || 0) + 1, 2)
    : 1;

  return {
    resultadoConfirmado: nextConfirmations >= 2,
    confirmacionesResultado: nextConfirmations,
  };
}

async function scorePredictions(tx, partido) {
  if (partido.golesEquipo1 == null || partido.golesEquipo2 == null) return 0;

  const predicciones = await tx.prediccion.findMany({ where: { partidoId: partido.id } });
  for (const prediccion of predicciones) {
    await tx.prediccion.update({
      where: { id: prediccion.id },
      data: {
        puntosOtorgados: calcularPuntos({
          golesEquipo1Predicho: prediccion.golesEquipo1Predicho,
          golesEquipo2Predicho: prediccion.golesEquipo2Predicho,
          golesEquipo1Real: partido.golesEquipo1,
          golesEquipo2Real: partido.golesEquipo2,
        }),
      },
    });
  }

  return predicciones.length;
}

async function upsertExternalMatch(dto, now = new Date()) {
  if (!isTracked(dto)) return { action: "ignored" };
  if (!hasUsableMatchData(dto)) return { action: "skipped" };

  return prisma.$transaction(async (tx) => {
    const competencia = await upsertCompetition(tx, dto.competition);
    const equipo1 = await upsertTeam(tx, dto.homeTeam);
    const equipo2 = await upsertTeam(tx, dto.awayTeam);
    const existing = await tx.partido.findFirst({
      where: { proveedor: PROVIDER, externalId: dto.externalId },
    });
    const clockState = computeClockState(existing, dto, now);
    const changed = didRelevantStateChange(existing, dto, clockState);
    const confirmation = buildResultConfirmation(existing, dto, changed);

    const data = {
      competenciaId: competencia.id,
      equipo1Id: equipo1.id,
      equipo2Id: equipo2.id,
      equipo1EsLocal: true,
      fecha: dto.utcDate,
      externalId: dto.externalId,
      proveedor: PROVIDER,
      estado: dto.status,
      golesEquipo1: dto.scoreHome,
      golesEquipo2: dto.scoreAway,
      minutoActual: clockState.minute,
      relojFase: clockState.phase,
      // fechaInicioReal now stores the reference start for the currently running
      // clock segment (1H, 2H, ET 1H, ET 2H). It is intentionally null while paused.
      fechaInicioReal: clockState.runStart,
      ultimaSyncExterna: now,
      ultimaActualizacionEstado: changed ? now : existing?.ultimaActualizacionEstado,
      ...confirmation,
    };

    const partido = existing
      ? await tx.partido.update({ where: { id: existing.id }, data })
      : await tx.partido.create({ data: { ...data, ultimaActualizacionEstado: now } });

    let predictionsScored = 0;
    const becameConfirmed = partido.resultadoConfirmado && !existing?.resultadoConfirmado;
    if (becameConfirmed) predictionsScored = await scorePredictions(tx, partido);

    return {
      action: existing ? "updated" : "created",
      changed,
      confirmed: becameConfirmed,
      predictionsScored,
      partidoId: partido.id,
    };
  });
}

function summarize(results) {
  return results.reduce((acc, result) => {
    acc[result.action] = (acc[result.action] || 0) + 1;
    if (result.changed) acc.changed += 1;
    if (result.confirmed) acc.confirmed += 1;
    acc.predictionsScored += result.predictionsScored || 0;
    return acc;
  }, { created: 0, updated: 0, ignored: 0, skipped: 0, changed: 0, confirmed: 0, predictionsScored: 0 });
}

async function syncMatches(name, fetchMatches) {
  const started = Date.now();
  logger.info("match_sync.start", { job: name });
  try {
    const matches = await fetchMatches();
    const results = [];
    for (const match of matches) results.push(await upsertExternalMatch(match));
    const summary = summarize(results);
    logger.info("match_sync.success", {
      job: name,
      received: matches.length,
      durationMs: Date.now() - started,
      ...summary,
    });
    return summary;
  } catch (error) {
    logger.error("match_sync.error", {
      job: name,
      durationMs: Date.now() - started,
      error: error.message,
      status: error.status,
      body: error.body,
    });
    throw error;
  }
}

function syncLiveMatches() {
  return syncMatches("syncLiveMatches", () => footballDataProvider.getLiveMatches());
}

function syncRecentMatches() {
  return syncMatches("syncRecentMatches", () => footballDataProvider.getRecentMatches());
}

function syncUpcomingFixtures() {
  return syncMatches("syncUpcomingFixtures", () =>
    footballDataProvider.getUpcomingMatches({ codes: TRACKED_COMPETITION_CODES, daysAhead: 30 }));
}

module.exports = {
  CLOCK_PHASE,
  computeClockState,
  TRACKED_COMPETITION_CODES,
  syncLiveMatches,
  syncRecentMatches,
  syncUpcomingFixtures,
  upsertExternalMatch,
};
