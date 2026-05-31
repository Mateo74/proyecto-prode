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
 * For PENALTY_SHOOTOUT (and EXTRA_TIME) matches the v4 API exposes both
 * `regularTime` and `extraTime` as separate fields. We sum those instead of
 * relying on `fullTime` (which embeds penalty goals) or `penalties` (which
 * has been observed to contain incorrect data, e.g. CL final 2026 returned
 * penalties: {home:3, away:3} for a match won 4-3 on pens).
 *
 * REGULAR matches only have `fullTime` + `halfTime`, so we fall back to that.
 */
function extractEffectiveScore(score) {
  if (!score) return { scoreHome: null, scoreAway: null };

  if (score.duration === "PENALTY_SHOOTOUT" || score.duration === "EXTRA_TIME") {
    const rt = score.regularTime ?? {};
    const et = score.extraTime ?? {};

    if (rt.home != null && rt.away != null) {
      return {
        scoreHome: rt.home + (et.home ?? 0),
        scoreAway: rt.away + (et.away ?? 0),
      };
    }
  }

  // REGULAR or fallback: fullTime is reliable
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
