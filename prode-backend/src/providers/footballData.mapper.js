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
 * Derive a rough current minute from kickoff time.
 *
 * NOTE: The authoritative match clock now lives in externalMatchSync.service,
 * where we model LIVE/PAUSED transitions and persist relojFase + minute.
 * This helper remains as a fallback for mapping DTOs before persistence.
 *
 * Logic:
 *  - Minutes 0-45:   first half, raw elapsed
 *  - Minutes 45-48:  first-half stoppage (cap raw at 45+3)
 *  - Minutes 48-63:  half-time + second half warm-up → show 45+3 until 2nd half starts
 *  - Minutes 63-108: second half (subtract 63 min offset to start at 46')
 *  - Minutes 108+:   second-half stoppage (cap at 90+3); beyond that → ET / final
 */
function deriveMinute(status, kickoffDate, now = new Date()) {
  if (status === "PAUSED") return 45;
  if (!["LIVE", "IN_PLAY"].includes(status) || !kickoffDate) return null;

  const started = new Date(kickoffDate).getTime();
  if (Number.isNaN(started)) return null;

  const raw = Math.max(0, Math.floor((now.getTime() - started) / 60000));

  // First half: 0-45 minutes (show +1 because "minute 35" starts after 34m elapsed)
  if (raw < 45) return raw + 1;

  // First-half stoppage window (raw 45-47): show 45+N
  if (raw <= 47) return raw; // caller/display converts: raw-45 → 45+N (here: 45,46,47)

  // Half-time window (approx 15 min) + start of 2nd half warm-up
  // raw 48-62: show 48 as a neutral "between halves" value (display shows 45+3)
  if (raw < 63) return 48;

  // Second half: raw 63 maps to minute 46, raw 107 maps to minute 90
  const secondHalf = raw - 63 + 46;
  if (secondHalf <= 90) return secondHalf;

  // Second-half stoppage: cap at 95 (90+5)
  return Math.min(secondHalf, 95);
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
    stage: match.stage || null,
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
