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

function deriveMinute(status, utcDate, now = new Date()) {
  if (status === "PAUSED") return 45;
  if (!["LIVE", "IN_PLAY"].includes(status) || !utcDate) return null;

  const started = new Date(utcDate).getTime();
  if (Number.isNaN(started)) return null;

  const elapsed = Math.max(1, Math.floor((now.getTime() - started) / 60000) + 1);
  return Math.min(elapsed, 120);
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
  return {
    externalId: String(match.id),
    provider: PROVIDER,
    statusExternal: match.status,
    status: mapStatus(match.status),
    utcDate: match.utcDate ? new Date(match.utcDate) : null,
    lastUpdatedExternal: match.lastUpdated ? new Date(match.lastUpdated) : null,
    minuteActual: deriveMinute(match.status, match.utcDate, now),
    scoreHome: match.score?.fullTime?.home ?? null,
    scoreAway: match.score?.fullTime?.away ?? null,
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

module.exports = { PROVIDER, mapCompetition, mapCompetitions, mapMatch, mapMatches, mapStatus };
