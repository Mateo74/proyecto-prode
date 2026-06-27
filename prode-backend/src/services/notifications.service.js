const { prisma } = require("../config/prisma");
const { sendNotification } = require("./push.service");
const logger = require("../utils/logger");

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const HOURS_2_MS  =  2 * 60 * 60 * 1000;
// Window width equals the job interval exactly — no gap, no overlap.
// A tiny jitter buffer (30s) absorbs scheduling imprecision without creating overlap.
const JITTER_MS = 30 * 1000;
const WINDOW_MS = CHECK_INTERVAL_MS + JITTER_MS;

/**
 * Finds entries that need a notification.
 * Returns one entry per (user × reminder window), with all unpredicted matches
 * for that window aggregated together.
 *
 * Conditions:
 *  - match belongs to a visible competencia
 *  - match kicks off in the 2h or 24h window (each window = CHECK_INTERVAL_MS + jitter)
 *  - user has at least one Expo push token
 *  - user has not yet made a prediction for that match
 *  - the (userId, partidoId, horasAntes) key is not in sentSet (in-memory dedup)
 *
 * Returns an array of: { userId, tokens, idioma, horasAntes, partidos[] }
 */
async function findUsersToNotify(now = new Date(), sentSet = new Set()) {
  // Two separate narrow windows — one per reminder type.
  // Each window is WINDOW_MS wide, ending at the target time + small jitter.
  // This guarantees every match is caught by exactly one job run with no gaps.
  const twoHourFrom = new Date(now.getTime() + HOURS_2_MS  - WINDOW_MS);
  const twoHourTo   = new Date(now.getTime() + HOURS_2_MS  + JITTER_MS);
  const dayFrom     = new Date(now.getTime() + HOURS_24_MS - WINDOW_MS);
  const dayTo       = new Date(now.getTime() + HOURS_24_MS + JITTER_MS);

  const partidos = await prisma.partido.findMany({
    where: {
      OR: [
        { fecha: { gte: twoHourFrom, lte: twoHourTo } },
        { fecha: { gte: dayFrom,     lte: dayTo } },
      ],
      estado: { in: ["FUTURO", "PROGRAMADO"] },
      competencia: { visible: true },
    },
    select: {
      id: true,
      fecha: true,
      competenciaId: true,
      competencia: { select: { nombre: true, nombreEn: true, slug: true } },
      equipo1: { select: { nombre: true } },
      equipo2: { select: { nombre: true } },
    },
  });

  if (!partidos.length) return [];

  // Pre-classify each match into its reminder window.
  // A match is in the 2h window if its fecha is at or before the 2h upper bound.
  const partidoInfo = {};
  for (const p of partidos) {
    const is2h = p.fecha <= twoHourTo;
    partidoInfo[p.id] = {
      partidoId: p.id,
      horasAntes: is2h ? 2 : 24,
      equipo1: p.equipo1?.nombre ?? "",
      equipo2: p.equipo2?.nombre ?? "",
      competenciaSlug: p.competencia?.slug ?? "",
      competenciaId: p.competenciaId,
    };
  }

  // All users who have at least one Expo push token
  const usuarios = await prisma.usuario.findMany({
    where: { expoTokens: { some: {} } },
    select: {
      id: true,
      idioma: true,
      expoTokens: { select: { id: true, token: true } },
    },
  });

  // Build userMap: every user gets every upcoming match as a candidate
  const allCandidates = Object.values(partidoInfo);
  const userMap = new Map();
  for (const usuario of usuarios) {
    if (!usuario.expoTokens.length) continue;
    userMap.set(usuario.id, {
      tokens: usuario.expoTokens,
      idioma: usuario.idioma,
      candidates: allCandidates,
    });
  }

  if (!userMap.size) return [];

  // Single bulk query for all existing predictions
  const allUserIds = [...userMap.keys()];
  const allPartidoIds = [...new Set(partidos.map((p) => p.id))];
  const existingPreds = await prisma.prediccion.findMany({
    where: { usuarioId: { in: allUserIds }, partidoId: { in: allPartidoIds } },
    select: { usuarioId: true, partidoId: true },
  });
  const predictedSet = new Set(existingPreds.map((p) => `${p.usuarioId}:${p.partidoId}`));

  // Group unpredicted, not-yet-sent matches per (user × horasAntes) → one notification each
  const results = [];
  for (const [userId, { tokens, idioma, candidates }] of userMap) {
    const unpredicted = candidates.filter(
      (c) => !predictedSet.has(`${userId}:${c.partidoId}`) &&
             !sentSet.has(`${userId}:${c.partidoId}:${c.horasAntes}`)
    );
    if (!unpredicted.length) continue;

    const by2h  = unpredicted.filter((c) => c.horasAntes === 2);
    const by24h = unpredicted.filter((c) => c.horasAntes === 24);

    if (by2h.length)  results.push({ userId, tokens, idioma, horasAntes: 2,  partidos: by2h });
    if (by24h.length) results.push({ userId, tokens, idioma, horasAntes: 24, partidos: by24h });
  }

  return results;
}

/**
 * Builds the notification payload for one aggregated entry.
 * Single match  → "Argentina vs Brasil — ¡Faltan 2 horas!"
 * Many matches  → "Argentina vs Brasil y 3 partidos más empiezan en 2 horas."
 */
function buildPayload(entry, frontendBaseUrl) {
  const { partidos, horasAntes, idioma } = entry;
  const en = idioma === "en";
  const count = partidos.length;
  const first = partidos[0];
  const firstMatch = `${first.equipo1} vs ${first.equipo2}`;

  let title, body;

  if (count === 1) {
    title = firstMatch;
    body = horasAntes === 2
      ? en
        ? "⚠️ Kick-off in 2 hours — make your prediction now!"
        : "⚠️ ¡Falta menos de 2 horas! Hacé tu predicción antes de que empiece."
      : en
        ? "This match is tomorrow — don't forget to predict!"
        : "Este partido es mañana. ¡No te olvides de predecir!";
  } else {
    const others = count - 1;
    const moreGames = en
      ? `${others} other game${others > 1 ? "s" : ""}`
      : `${others} partido${others > 1 ? "s" : ""} más`;

    title = horasAntes === 2
      ? en ? "⚠️ Games starting soon!" : "⚠️ ¡Partidos por empezar!"
      : en ? "Predict tomorrow's games" : "Predecí los partidos de mañana";

    body = horasAntes === 2
      ? en
        ? `${firstMatch} and ${moreGames} start in 2 hours — make your predictions!`
        : `${firstMatch} y ${moreGames} empiezan en 2 horas. ¡Predecí ahora!`
      : en
        ? `${firstMatch} and ${moreGames} are tomorrow — don't forget to predict!`
        : `${firstMatch} y ${moreGames} son mañana. ¡No te olvides de predecir!`;
  }

  // Deep-link to the competencia if all matches are from the same one; otherwise go to predicciones
  const slugs = [...new Set(partidos.map((p) => p.competenciaSlug))];
  const url = slugs.length === 1
    ? `${frontendBaseUrl}/?competencia=${encodeURIComponent(slugs[0])}#predicciones`
    : `${frontendBaseUrl}/#predicciones`;

  return { title, body, data: { url } };
}

/**
 * Main entry point called by the job.
 * sentSet is a persistent in-memory Set maintained by the job across runs.
 * It prevents duplicate notifications if the job's windows briefly overlap
 * due to scheduling jitter or a restart mid-window.
 */
async function sendMatchReminders(frontendBaseUrl, sentSet = new Set(), now = new Date()) {
  const pending = await findUsersToNotify(now, sentSet);

  let sent = 0;
  let expired = 0;
  let failed = 0;
  const staleIds = [];

  for (const entry of pending) {
    const payload = buildPayload(entry, frontendBaseUrl);
    let anySent = false;
    for (const t of entry.tokens) {
      const result = await sendNotification(t.token, payload);
      if (result.sent) {
        sent++;
        anySent = true;
      } else if (result.reason === "expired") {
        staleIds.push(t.id);
        expired++;
      } else {
        failed++;
      }
    }
    // Mark sent in the in-memory set so the next run skips these
    if (anySent) {
      for (const p of entry.partidos) {
        sentSet.add(`${entry.userId}:${p.partidoId}:${entry.horasAntes}`);
      }
    }
  }

  if (staleIds.length) {
    await prisma.expoToken.deleteMany({ where: { id: { in: staleIds } } });
    logger.info("notifications.cleaned_expired", { count: staleIds.length });
  }

  logger.info("notifications.sent", { pending: pending.length, sent, expired, failed });
  return { pending: pending.length, sent, expired, failed };
}

module.exports = { findUsersToNotify, buildPayload, sendMatchReminders };
