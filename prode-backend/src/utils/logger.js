function log(level, event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  writer(JSON.stringify(entry));
}

module.exports = {
  debug: (event, data) => log("debug", event, data),
  error: (event, data) => log("error", event, data),
  info: (event, data) => log("info", event, data),
  warn: (event, data) => log("warn", event, data),
};
