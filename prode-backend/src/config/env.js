require("dotenv/config");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no esta configurada`);
  return value;
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET no esta configurada");
  }
  console.warn("JWT_SECRET no esta configurada. Usando secreto local inseguro de desarrollo.");
  return "dev-insecure-jwt-secret-change-me";
}

const isProd = process.env.NODE_ENV === "production";

const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: required("DATABASE_URL"),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  JWT_SECRET: getJwtSecret(),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || "15m",
  JWT_TTL: process.env.JWT_TTL || "7d",
  COOKIE_SECURE: process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : isProd,
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (isProd ? "None" : "Lax"),
  CORS_ORIGINS: process.env.CORS_ORIGINS || "",
  FOOTBAL_DATA_TOKEN: process.env.FOOTBAL_DATA_TOKEN || process.env.FOOTBALL_DATA_TOKEN || "",
  FOOTBALL_DATA_BASE_URL: process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4",
  FOOTBALL_DATA_SYNC_ENABLED: process.env.FOOTBALL_DATA_SYNC_ENABLED !== "false",
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "https://www.oncemetros.com",
  NOTIFICATIONS_ENABLED: process.env.NOTIFICATIONS_ENABLED !== "false",
};

module.exports = env;
