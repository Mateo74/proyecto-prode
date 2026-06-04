const { prisma } = require("../config/prisma");
const logger = require("../utils/logger");
const footballDataProvider = require("../providers/footballData.provider");
const { PROVIDER } = require("../providers/footballData.mapper");
const { slugify } = require("../utils/slugify");

const VISIBLE_COMPETITION_CODES = new Set(["WC", "CL", "BSA"]);

const COMPETITION_ALIASES = {
  WC: { slug: "copa-mundial-fifa", nombre: "Copa Mundial FIFA" },
  CL: { slug: "champions-league", nombre: "UEFA Champions League" },
  BSA: { slug: "brasileirao", nombre: "Brasileirao" },
  CLI: { slug: "copa-libertadores", nombre: "Copa Libertadores" },
};

function competenciaData(dto) {
  const alias = COMPETITION_ALIASES[dto.code];
  return {
    nombre: alias?.nombre || dto.name,
    slug: alias?.slug || slugify(dto.code || dto.name || dto.externalId),
    externalId: dto.externalId,
    proveedor: PROVIDER,
    visible: VISIBLE_COMPETITION_CODES.has(dto.code),
  };
}

async function upsertCompetition(dto) {
  const data = competenciaData(dto);
  const existing = await prisma.competencia.findFirst({
    where: {
      OR: [
        { proveedor: PROVIDER, externalId: dto.externalId },
        { slug: data.slug },
      ],
    },
  });

  if (existing) {
    await prisma.competencia.update({
      where: { id: existing.id },
      data,
    });
    return { action: "updated", competenciaId: existing.id, code: dto.code, visible: data.visible };
  }

  const created = await prisma.competencia.create({ data });
  return { action: "created", competenciaId: created.id, code: dto.code, visible: data.visible };
}

function summarize(results) {
  return results.reduce((acc, result) => {
    acc[result.action] = (acc[result.action] || 0) + 1;
    if (result.visible) acc.visible += 1;
    return acc;
  }, { created: 0, updated: 0, visible: 0 });
}

async function syncExternalCompetitions() {
  const started = Date.now();
  logger.info("competition_sync.start", { provider: PROVIDER });

  try {
    const competitions = await footballDataProvider.getCompetitions();
    const results = [];
    for (const competition of competitions) results.push(await upsertCompetition(competition));
    const summary = summarize(results);

    logger.info("competition_sync.success", {
      provider: PROVIDER,
      received: competitions.length,
      durationMs: Date.now() - started,
      ...summary,
    });

    return { received: competitions.length, ...summary };
  } catch (error) {
    logger.error("competition_sync.error", {
      provider: PROVIDER,
      durationMs: Date.now() - started,
      error: error.message,
      status: error.status,
      body: error.body,
    });
    throw error;
  }
}

module.exports = {
  COMPETITION_ALIASES,
  VISIBLE_COMPETITION_CODES,
  syncExternalCompetitions,
  upsertCompetition,
};
