const NODE_ENV = process.env.NODE_ENV || "development";

function parseCorsOrigins(raw) {
  if (!raw || !raw.trim()) return null;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsOptions(corsOriginsRaw) {
  const allowed = parseCorsOrigins(corsOriginsRaw);

  if (!allowed) {
    if (NODE_ENV === "production") {
      console.warn(
        "CORS_ORIGINS no esta configurada. Se permiten solicitudes sin header Origin (apps nativas, curl)."
      );
    }
    return {
      credentials: true,
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (NODE_ENV !== "production") return callback(null, true);
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
      },
    };
  }

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  };
}

module.exports = { buildCorsOptions };
