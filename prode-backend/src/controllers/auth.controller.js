const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const env = require("../config/env");
const { httpError } = require("../utils/httpError");
const {
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  parseTTLtoMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyGoogleIdToken,
  verifyPassword,
} =
  require("../services/auth.service");
const { usuarioResponse } = require("../serializers/usuario.serializer");

const REFRESH_COOKIE = "refresh_token";
const REFRESH_MAX_AGE_MS = parseTTLtoMs(env.JWT_TTL);

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: REFRESH_MAX_AGE_MS,
    path: "/api/auth",
  };
}

async function issueTokens(res, usuario) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_MS);
  await prisma.refreshToken.create({
    data: { id: jti, usuarioId: usuario.id, expiresAt },
  });
  const accessToken = signAccessToken(usuario);
  res.cookie(REFRESH_COOKIE, signRefreshToken(jti), refreshCookieOptions());
  return accessToken;
}

function baseUsernameFromGoogleProfile({ email, name }) {
  const candidate = String(email || name || "google")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  const base = candidate || "google";
  return base.length >= 3 ? base.slice(0, 20) : base.padEnd(3, "0");
}

async function generateUniqueUsername(base) {
  for (let i = 0; i < 20; i += 1) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    const username = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    const existing = await prisma.usuario.findUnique({ where: { username } });
    if (!existing) return username;
  }
  return `${base.slice(0, 15)}-${Date.now().toString(36).slice(-8)}`;
}

async function register(req, res) {
  const username = normalizeUsername(req.body.username);
  const email = req.body.email ? normalizeEmail(req.body.email) : null;
  const password = req.body.password;
  const nombre = (req.body.nombre || username).trim();
  const apellido = req.body.apellido?.trim() || null;

  const existente = await prisma.usuario.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });
  if (existente) throw httpError(409, "Ya existe una cuenta con ese usuario o email");

  const usuario = await prisma.usuario.create({
    data: { nombre, apellido, username, email, hashClave: await hashPassword(password) },
    include: { hinchaDe: true },
  });

  const token = await issueTokens(res, usuario);
  res.status(201).json({ token, usuario: usuarioResponse(usuario) });
}

async function login(req, res) {
  const identificador = String(
    req.body.identificador ?? req.body.username ?? req.body.email ?? "",
  ).trim().toLowerCase();
  const password = req.body.password;

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ username: identificador }, { email: identificador }] },
    include: { hinchaDe: true },
  });

  if (!usuario || !usuario.activo || !(await verifyPassword(password, usuario.hashClave))) {
    throw httpError(401, "Credenciales invalidas");
  }

  const token = await issueTokens(res, usuario);
  res.json({ token, usuario: usuarioResponse(usuario) });
}

async function googleLogin(req, res) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw httpError(503, "Google auth no esta configurado");
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(req.body.idToken);
  } catch {
    throw httpError(401, "Token de Google invalido");
  }

  const googleId = payload?.sub;
  const email = normalizeEmail(payload?.email);
  const emailVerificado = payload?.email_verified === true || payload?.email_verified === "true";

  if (!googleId || !email || !emailVerificado) {
    throw httpError(401, "Google no verifico el email de la cuenta");
  }

  let usuario = await prisma.usuario.findUnique({
    where: { googleId },
    include: { hinchaDe: true },
  });

  if (!usuario) {
    usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { hinchaDe: true },
    });
  }

  if (usuario) {
    if (!usuario.activo) throw httpError(401, "La cuenta esta inactiva");
    if (usuario.googleId && usuario.googleId !== googleId) {
      throw httpError(409, "Ese email ya esta asociado a otra cuenta de Google");
    }

    if (!usuario.googleId || !usuario.emailVerificado) {
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { googleId, emailVerificado: true },
        include: { hinchaDe: true },
      });
    }
  } else {
    const baseUsername = baseUsernameFromGoogleProfile({ email, name: payload.name });
    const username = await generateUniqueUsername(baseUsername);
    usuario = await prisma.usuario.create({
      data: {
        nombre: payload.given_name || payload.name || username,
        apellido: payload.family_name || null,
        username,
        email,
        emailVerificado: true,
        googleId,
      },
      include: { hinchaDe: true },
    });
  }

  const token = await issueTokens(res, usuario);
  res.json({ token, usuario: usuarioResponse(usuario) });
}

async function refresh(req, res) {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) throw httpError(401, "Sesión expirada");

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    throw httpError(401, "Sesión inválida o expirada");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    throw httpError(401, "Sesión inválida o expirada");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: stored.usuarioId },
    include: { hinchaDe: true },
  });

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  if (!usuario || !usuario.activo) {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    throw httpError(401, "Usuario no valido");
  }

  const token = await issueTokens(res, usuario);
  res.json({ token });
}

async function me(req, res) {
  res.json({ usuario: usuarioResponse(req.usuario) });
}

async function logout(req, res) {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) {
    try {
      const payload = verifyRefreshToken(rawToken);
      await prisma.refreshToken.deleteMany({ where: { id: payload.jti } });
    } catch {
      // Ignore invalid token on logout
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
}

module.exports = { googleLogin, login, logout, me, refresh, register };
