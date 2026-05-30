const PROVIDER = "football-data";

const STATUS_MAP = {
  SCHEDULED: "PROGRAMADO",
  TIMED: "PROGRAMADO",
  LIVE: "EN_JUEGO",
  IN_PLAY: "EN_JUEGO",
  PAUSED: "EN_JUEGO",
  FINISHED: "TERMINADO",
  POSTPONED: "SUSPENDIDO",
  SUSPENDED: "SUSPENDIDO",
  CANCELLED: "CANCELADO",
};

function mapStatus(status) {
  return STATUS_MAP[status] || "FUTURO";
}

function tipoEquipoDeCompetencia(competitionCode) {
  return competitionCode === "WC" ? "SELECCION" : "CLUB";
}

/**
 * Derive the current match minute from the actual kickoff time.
 * The football-data.org free tier does not expose a live minute field,
 * so we calculate elapsed time from the real start (or scheduled start).
 * Pass fechaInicioReal when available so delayed matches are handled correctly.
 */
function deriveMinute(status, kickoffDate, now = new Date()) {
  if (status === "PAUSED") return 45;
  if (!["LIVE", "IN_PLAY"].includes(status) || !kickoffDate) return null;

  const started = new Date(kickoffDate).getTime();
  if (Number.isNaN(started)) return null;

  const elapsed = Math.max(1, Math.floor((now.getTime() - started) / 60000) + 1);
  return Math.min(elapsed, 120);
}

/**
 * Extract the effective (pre-penalty) score from a football-data score object.
 *
 * Some football-data API tiers embed penalty goals into score.fullTime for
 * PENALTY_SHOOTOUT matches (e.g. a 1-1 AET match decided 4-3 on pens would
 * be reported as fullTime {home:5, away:4}). We detect this by subtracting
 * score.penalties from fullTime; if the result is non-negative we use it,
 * otherwise fullTime does NOT include penalties and we use it directly.
 */
function extractEffectiveScore(score) {
  if (!score) return { scoreHome: null, scoreAway: null };

  if (score.duration === "PENALTY_SHOOTOUT") {
    const ft = score.fullTime ?? {};
    const pen = score.penalties ?? {};

    if (ft.home != null && ft.away != null && pen.home != null && pen.away != null) {
      const h = ft.home - pen.home;
      const a = ft.away - pen.away;
      // Sanity check: result must be non-negative (otherwise API did NOT embed penalties)
      if (h >= 0 && a >= 0) {
        return { scoreHome: h, scoreAway: a };
      }
    }
  }

  return {
    scoreHome: score.fullTime?.home ?? null,
    scoreAway: score.fullTime?.away ?? null,
  };
}

function mapTeam(team, competitionCode) {
  if (!team?.id || !team?.name) return null;
  return {
    externalId: String(team.id),
    nombre: team.shortName || team.name,
    nombreCompleto: team.name,
    abreviatura: team.tla || null,
    escudoUrl: team.crest || null,
    tipo: tipoEquipoDeCompetencia(competitionCode),
  };
}

function mapMatch(match, now = new Date()) {
  const competitionCode = match.competition?.code;
  const effectiveScore = extractEffectiveScore(match.score);
  return {
    externalId: String(match.id),
    provider: PROVIDER,
    statusExternal: match.status,
    status: mapStatus(match.status),
    utcDate: match.utcDate ? new Date(match.utcDate) : null,
    lastUpdatedExternal: match.lastUpdated ? new Date(match.lastUpdated) : null,
    // minuteActual is recalculated in the sync service using fechaInicioReal
    minuteActual: deriveMinute(match.status, match.utcDate, now),
    scoreHome: effectiveScore.scoreHome,
    scoreAway: effectiveScore.scoreAway,
    competition: match.competition
      ? {
          externalId: String(match.competition.id),
          code: match.competition.code || String(match.competition.id),
          name: match.competition.name,
          type: match.competition.type,
          emblem: match.competition.emblem || null,
        }
      : null,
    homeTeam: mapTeam(match.homeTeam, competitionCode),
    awayTeam: mapTeam(match.awayTeam, competitionCode),
  };
}

function mapCompetition(competition) {
  return {
    externalId: String(competition.id),
    provider: PROVIDER,
    code: competition.code || String(competition.id),
    name: competition.name,
    type: competition.type,
    emblem: competition.emblem || null,
    area: competition.area
      ? {
          id: competition.area.id ? String(competition.area.id) : null,
          name: competition.area.name || null,
          code: competition.area.code || null,
        }
      : null,
    currentSeason: competition.currentSeason || null,
    lastUpdatedExternal: competition.lastUpdated ? new Date(competition.lastUpdated) : null,
  };
}

function mapMatches(payload, now = new Date()) {
  return (payload.matches || []).map((match) => mapMatch(match, now));
}

function mapCompetitions(payload) {
  return (payload.competitions || []).map(mapCompetition);
}

module.exports = { PROVIDER, deriveMinute, mapCompetition, mapCompetitions, mapMatch, mapMatches, mapStatus };
