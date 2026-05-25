const env = require("../config/env");
const logger = require("../utils/logger");
const {
  syncLiveMatches,
  syncRecentMatches,
  syncUpcomingFixtures,
} = require("../services/externalMatchSync.service");

const JOBS = [
  { name: "syncLiveMatches", intervalMs: 30_000, run: syncLiveMatches },
  { name: "syncRecentMatches", intervalMs: 5 * 60_000, run: syncRecentMatches },
  { name: "syncUpcomingFixtures", intervalMs: 60 * 60_000, run: syncUpcomingFixtures },
];

function scheduleJob({ name, intervalMs, run }) {
  let running = false;

  const wrapped = async () => {
    if (running) {
      logger.warn("match_sync.skipped_overlap", { job: name });
      return;
    }
    running = true;
    try {
      await run();
    } catch {
      // El error ya queda registrado con contexto dentro del servicio de sync.
    } finally {
      running = false;
    }
  };

  const timer = setInterval(wrapped, intervalMs);
  timer.unref?.();
  void wrapped();
  return timer;
}

function startExternalMatchSyncJobs() {
  if (!env.FOOTBALL_DATA_SYNC_ENABLED) {
    logger.info("match_sync.disabled", { reason: "FOOTBALL_DATA_SYNC_ENABLED=false" });
    return [];
  }

  if (!env.FOOTBAL_DATA_TOKEN) {
    logger.warn("match_sync.disabled", { reason: "FOOTBAL_DATA_TOKEN no esta configurada" });
    return [];
  }

  logger.info("match_sync.scheduler_started", {
    jobs: JOBS.map((job) => ({ name: job.name, intervalMs: job.intervalMs })),
  });

  return JOBS.map(scheduleJob);
}

module.exports = { startExternalMatchSyncJobs };
