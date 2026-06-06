const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const env = require("./config/env");
const { buildCorsOptions } = require("./config/cors");
const apiRouter = require("./routes");
const { errorHandler, notFound } = require("./middlewares/errorHandler.middleware");
const {
  metricsHandler,
  requestTelemetry,
} = require("./middlewares/requestTelemetry.middleware");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors(buildCorsOptions(env.CORS_ORIGINS)));
  app.use(cookieParser());
  app.use(express.json({ limit: '400kb' }));
  app.use(requestTelemetry);

  // Health-check — used by Azure "Always On" and uptime monitors to prevent cold starts
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/metrics", metricsHandler);

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
