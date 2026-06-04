const logger = require("../utils/logger");

function notFound(req, res) {
  res.status(404).json({ message: "Ruta no encontrada" });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = status === 500 ? "Error interno del servidor" : err.message;

  if (status === 500) {
    logger.error("http.error", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: err.message,
      stack: err.stack,
    });
  }

  const body = { message };
  if (err.issues) body.issues = err.issues;

  res.status(status).json(body);
}

module.exports = { errorHandler, notFound };
