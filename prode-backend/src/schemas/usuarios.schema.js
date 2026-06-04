const { registry, z } = require("../openapi/registry");

const updateUsuarioBody = registry.register(
  "UsuarioUpdateBody",
  z.object({
    nombre: z.string().trim().min(1).max(80).optional(),
    apellido: z.string().trim().max(80).nullish(),
    telefono: z.string().trim().max(40).nullish(),
    hinchaDeEquipoId: z.string().nullish(),
    fotoPerfil: z.string().max(200_000).nullish(),
    idioma: z.enum(['es', 'en']).nullish(),
  }).strict(),
);

module.exports = { updateUsuarioBody };
