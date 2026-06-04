const crypto = require("node:crypto");
const logger = require("../utils/logger");
const metrics = require("../telemetry/metrics");

function durationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function requestTelemetry(req, res, next) {
  req.id = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);

  const startedAt = process.hrtime.bigint();
  metrics.startRequest();

  res.on("finish", () => {
    const elapsed = durationMs(startedAt);
    const route = metrics.routeName(req);
    metrics.finishRequest({
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: elapsed,
    });

    if (route !== "/health" && route !== "/metrics") {
      logger.info("http.request", {
        requestId: req.id,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Number(elapsed.toFixed(2)),
      });
    }
  });

  next();
}

function metricsHandler(_req, res) {
  res.type("text/plain; version=0.0.4; charset=utf-8").send(metrics.renderPrometheus());
}

module.exports = { metricsHandler, requestTelemetry };
