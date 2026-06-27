const { registry, z } = require("../openapi/registry");

const ESTADO_FRONT = ["proximo", "en-vivo", "finalizado", "suspendido", "cancelado"];

const listPartidosQuery = z.object({
  liga: z.string().trim().optional(),
  competenciaId: z.string().trim().optional(),
  estado: z.enum(ESTADO_FRONT).optional(),
  // Include knockout fixtures whose teams aren't decided yet (bracket view only).
  incluirSinEquipos: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const goles = z.coerce.number().int("Debe ser entero").min(0, "Min 0").max(20, "Max 20");

const cerrarPartidoBody = registry.register(
  "PartidoCerrarBody",
  z.object({
    golesEquipo1: goles.optional(),
    golesEquipo2: goles.optional(),
    golesLocal: goles.optional(),
    golesVisitante: goles.optional(),
  }).refine(
    (data) =>
      (data.golesEquipo1 !== undefined || data.golesLocal !== undefined) &&
      (data.golesEquipo2 !== undefined || data.golesVisitante !== undefined),
    { message: "Faltan goles del equipo 1 o del equipo 2" },
  ),
);

const partidoPayload = registry.register(
  "Partido",
  z.object({
    id: z.string(),
    competenciaId: z.string(),
    liga: z.string().optional(),
    competencia: z
      .object({ id: z.string(), nombre: z.string(), slug: z.string() })
      .nullable(),
    equipo1Id: z.string().nullable(),
    equipo1: z.string().nullable(),
    equipo1NombreCompleto: z.string().nullable(),
    equipo1Tipo: z.enum(["CLUB", "SELECCION"]).nullable(),
    equipo1EscudoUrl: z.string().nullable().optional(),
    equipo2Id: z.string().nullable(),
    equipo2: z.string().nullable(),
    equipo2NombreCompleto: z.string().nullable(),
    equipo2Tipo: z.enum(["CLUB", "SELECCION"]).nullable(),
    equipo2EscudoUrl: z.string().nullable().optional(),
    equipo1EsLocal: z.boolean(),
    etapa: z.string().nullable(),
    estado: z.enum(ESTADO_FRONT),
    estadoRaw: z.string(),
    scoreEquipo1: z.number().nullable(),
    scoreEquipo2: z.number().nullable(),
    minutoActual: z.number().nullable(),
    relojFase: z.number().int().nullable().optional(),
    fechaInicioReal: z.string().datetime().or(z.date()).nullable(),
    ultimaSyncExterna: z.string().datetime().or(z.date()).nullable(),
    ultimaActualizacion: z.string().datetime().or(z.date()).nullable(),
    resultadoConfirmado: z.boolean(),
    prediccionEditable: z.boolean(),
    fecha: z.string().datetime().or(z.date()),
    userPred: z
      .object({
        id: z.string(),
        scoreEquipo1: z.number(),
        scoreEquipo2: z.number(),
        estado: z.enum(["pendiente", "acierto", "fallo"]),
        puntos: z.number(),
        exacto: z.boolean(),
      })
      .nullable(),
  }),
);

module.exports = { cerrarPartidoBody, listPartidosQuery, partidoPayload };
