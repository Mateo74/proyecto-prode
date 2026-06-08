const { registry, z } = require("../openapi/registry");

const goles = z.coerce.number().int("Debe ser entero").min(0, "Min 0").max(20, "Max 20");

const createPrediccionBody = registry.register(
  "PrediccionCreateBody",
  z.object({
    matchId: z.string().min(1),
    scoreEquipo1: goles.optional(),
    scoreEquipo2: goles.optional(),
    scoreLocal: goles.optional(),
    scoreVisitante: goles.optional(),
  }).refine(
    (data) =>
      (data.scoreEquipo1 !== undefined || data.scoreLocal !== undefined) &&
      (data.scoreEquipo2 !== undefined || data.scoreVisitante !== undefined),
    { message: "Faltan los goles del equipo 1 o del equipo 2" },
  ),
);

const updatePrediccionBody = registry.register(
  "PrediccionUpdateBody",
  z.object({
    scoreEquipo1: goles.optional(),
    scoreEquipo2: goles.optional(),
    scoreLocal: goles.optional(),
    scoreVisitante: goles.optional(),
  }).refine(
    (data) =>
      (data.scoreEquipo1 !== undefined || data.scoreLocal !== undefined) &&
      (data.scoreEquipo2 !== undefined || data.scoreVisitante !== undefined),
    { message: "Faltan los goles del equipo 1 o del equipo 2" },
  ),
);

const prediccionPayload = registry.register(
  "Prediccion",
  z.object({
    id: z.string(),
    matchId: z.string(),
    equipo1Id: z.string(),
    equipo1: z.string(),
    equipo1NombreCompleto: z.string().nullable(),
    equipo1Tipo: z.enum(["CLUB", "SELECCION"]),
    equipo2Id: z.string(),
    equipo2: z.string(),
    equipo2NombreCompleto: z.string().nullable(),
    equipo2Tipo: z.enum(["CLUB", "SELECCION"]),
    liga: z.string().optional(),
    competenciaId: z.string(),
    fecha: z.string().datetime().or(z.date()),
    scoreEquipo1Pred: z.number(),
    scoreEquipo2Pred: z.number(),
    scoreEquipo1: z.number().nullable(),
    scoreEquipo2: z.number().nullable(),
    estado: z.enum(["pendiente", "acierto", "fallo"]),
    puntos: z.number(),
    exacto: z.boolean(),
  }),
);

module.exports = { createPrediccionBody, prediccionPayload, updatePrediccionBody };
