const startedAt = Date.now();
const routeStats = new Map();
let inFlight = 0;

function keyOf({ method, route, status }) {
  return JSON.stringify({ method, route, status });
}

function labels({ method, route, status }) {
  return `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"`;
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function routeName(req) {
  if (req.route?.path) {
    const base = req.baseUrl || "";
    const routePath = req.route.path === "/" ? "" : req.route.path;
    return `${base}${routePath}` || "/";
  }
  return req.path || req.originalUrl.split("?")[0] || "/";
}

function startRequest() {
  inFlight += 1;
}

function finishRequest({ method, route, status, durationMs }) {
  inFlight = Math.max(0, inFlight - 1);
  const key = keyOf({ method, route, status });
  const current = routeStats.get(key) || {
    method,
    route,
    status,
    count: 0,
    durationMsSum: 0,
    durationMsMax: 0,
  };

  current.count += 1;
  current.durationMsSum += durationMs;
  current.durationMsMax = Math.max(current.durationMsMax, durationMs);
  routeStats.set(key, current);
}

function renderPrometheus() {
  const lines = [
    "# HELP once_metros_process_uptime_seconds Process uptime in seconds.",
    "# TYPE once_metros_process_uptime_seconds gauge",
    `once_metros_process_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
    "# HELP once_metros_http_requests_in_flight Current HTTP requests in flight.",
    "# TYPE once_metros_http_requests_in_flight gauge",
    `once_metros_http_requests_in_flight ${inFlight}`,
    "# HELP once_metros_http_requests_total Total HTTP requests by method, route, and status.",
    "# TYPE once_metros_http_requests_total counter",
  ];

  for (const stat of routeStats.values()) {
    lines.push(`once_metros_http_requests_total{${labels(stat)}} ${stat.count}`);
  }

  lines.push(
    "# HELP once_metros_http_request_duration_ms_sum Sum of HTTP request durations in milliseconds.",
    "# TYPE once_metros_http_request_duration_ms_sum counter",
  );
  for (const stat of routeStats.values()) {
    lines.push(`once_metros_http_request_duration_ms_sum{${labels(stat)}} ${stat.durationMsSum.toFixed(3)}`);
  }

  lines.push(
    "# HELP once_metros_http_request_duration_ms_max Max HTTP request duration in milliseconds since process start.",
    "# TYPE once_metros_http_request_duration_ms_max gauge",
  );
  for (const stat of routeStats.values()) {
    lines.push(`once_metros_http_request_duration_ms_max{${labels(stat)}} ${stat.durationMsMax.toFixed(3)}`);
  }

  return `${lines.join("\n")}\n`;
}

module.exports = {
  finishRequest,
  renderPrometheus,
  routeName,
  startRequest,
};
