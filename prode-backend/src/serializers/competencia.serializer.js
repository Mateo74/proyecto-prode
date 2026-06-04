function competenciaResponse(competencia) {
  return {
    id: competencia.id,
    nombre: competencia.nombre,
    nombreEn: competencia.nombreEn ?? null,
    slug: competencia.slug,
    externalId: competencia.externalId,
    proveedor: competencia.proveedor,
    terminada: competencia.terminada ?? false,
  };
}

module.exports = { competenciaResponse };
