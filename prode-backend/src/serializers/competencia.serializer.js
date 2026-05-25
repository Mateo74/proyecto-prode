function competenciaResponse(competencia) {
  return {
    id: competencia.id,
    nombre: competencia.nombre,
    slug: competencia.slug,
    externalId: competencia.externalId,
    proveedor: competencia.proveedor,
  };
}

module.exports = { competenciaResponse };
