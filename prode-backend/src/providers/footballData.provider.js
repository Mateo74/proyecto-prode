const env = require("../config/env");
const logger = require("../utils/logger");
const { mapCompetitions, mapMatches, mapMatch } = require("./footballData.mapper");

class FootballDataApiError extends Error {
  constructor(message, { status, body, endpoint }) {
    super(message);
    this.name = "FootballDataApiError";
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

function assertToken() {
  if (!env.FOOTBAL_DATA_TOKEN) {
    throw new FootballDataApiError("FOOTBAL_DATA_TOKEN no esta configurada", {
      status: 0,
      body: null,
      endpoint: null,
    });
  }
}

function buildEndpoint(path, params = {}) {
  const url = new URL(`${env.FOOTBALL_DATA_BASE_URL.replace(/\/$/, "")}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  return url;
}

async function request(path, params = {}) {
  assertToken();
  const url = buildEndpoint(path, params);
  const started = Date.now();

  logger.info("football_data.request.start", {
    method: "GET",
    endpoint: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
  });

  let response;
  try {
    response = await fetch(url, {
      headers: { "X-Auth-Token": env.FOOTBAL_DATA_TOKEN },
    });
  } catch (error) {
    logger.error("football_data.request.network_error", {
      endpoint: url.pathname,
      error: error.message,
      durationMs: Date.now() - started,
    });
    throw error;
  }

  const body = await response.json().catch(() => null);
  const meta = {
    endpoint: url.pathname,
    status: response.status,
    durationMs: Date.now() - started,
  };

  if (!response.ok) {
    logger.error("football_data.request.api_error", {
      ...meta,
      body,
    });
    throw new FootballDataApiError("Football Data respondio con error", {
      status: response.status,
      body,
      endpoint: url.pathname,
    });
  }

  logger.info("football_data.request.success", {
    ...meta,
    count: body?.matches?.length ?? body?.competitions?.length ?? null,
  });

  return body;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function getLiveMatches() {
  const payload = await request("/matches", { status: "LIVE" });
  return mapMatches(payload);
}

async function getCompetitions() {
  const payload = await request("/competitions");
  return mapCompetitions(payload);
}

async function getCompetitionMatches(code) {
  const payload = await request(`/competitions/${encodeURIComponent(code)}/matches`);
  return mapMatches(payload);
}

async function getUpcomingMatches({ codes = [], daysAhead = 14 } = {}) {
  const from = new Date();
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + daysAhead);

  if (codes.length) {
    const batches = await Promise.all(codes.map((code) => getCompetitionMatches(code)));
    return batches.flat().filter((match) =>
      match.utcDate &&
      match.utcDate >= from &&
      match.utcDate <= to &&
      ["FUTURO", "PROGRAMADO"].includes(match.status));
  }

  const payload = await request("/matches", {
    dateFrom: isoDate(new Date()),
    dateTo: isoDate(to),
  });
  return mapMatches(payload);
}

async function getRecentMatches({ daysBack = 2, daysAhead = 1 } = {}) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - daysBack);
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + daysAhead);
  const payload = await request("/matches", {
    dateFrom: isoDate(from),
    dateTo: isoDate(to),
  });
  return mapMatches(payload);
}

async function getMatch(id) {
  const payload = await request(`/matches/${encodeURIComponent(id)}`);
  return mapMatch(payload);
}

module.exports = {
  FootballDataApiError,
  getCompetitions,
  getCompetitionMatches,
  getLiveMatches,
  getMatch,
  getRecentMatches,
  getUpcomingMatches,
};
