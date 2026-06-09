const env = require("../config/env");
const logger = require("../utils/logger");
const { sendMatchReminders } = require("../services/notifications.service");

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

function startNotificationsJob() {
  if (!env.NOTIFICATIONS_ENABLED) {
    logger.info("notifications.disabled", { reason: "NOTIFICATIONS_ENABLED=false" });
    return null;
  }

  // Persists across runs for the lifetime of the process.
  // Prevents duplicate sends if the 30s jitter buffer causes two runs to overlap.
  // Automatically becomes irrelevant after a restart (acceptable — one extra notification
  // is far less disruptive than a DB write on every notification sent).
  const sentSet = new Set();

  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await sendMatchReminders(env.FRONTEND_BASE_URL, sentSet);
    } catch (err) {
      logger.error("notifications.job_error", { error: err.message, stack: err.stack });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref?.();
  void run();

  logger.info("notifications.scheduler_started", { intervalMs: CHECK_INTERVAL_MS });
  return timer;
}

module.exports = { startNotificationsJob };
