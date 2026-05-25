const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const env = require("../config/env");

const SALT_ROUNDS = 12;
const googleClient = new OAuth2Client();

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value || null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function parseTTLtoMs(ttl) {
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const match = /^(\d+)([smhd]?)$/.exec(String(ttl).trim());
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const unit = match[2] || "s";
  return Number(match[1]) * units[unit];
}

function signAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, username: usuario.username, rol: usuario.rol },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL },
  );
}

function signAuthToken(usuario) {
  return signAccessToken(usuario);
}

function signRefreshToken(jti) {
  return jwt.sign({ jti }, env.JWT_SECRET, { expiresIn: env.JWT_TTL });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

module.exports = {
  getBearerToken,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  parseTTLtoMs,
  signAccessToken,
  signAuthToken,
  signRefreshToken,
  verifyGoogleIdToken,
  verifyAuthToken,
  verifyRefreshToken,
  verifyPassword,
};
