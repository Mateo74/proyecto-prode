// Predicciones del usuario "demo" para la fase de grupos del Mundial 2026.
// Marcadores deterministas y variados. Se deja el grupo L sin predicciones para
// mostrar el contraste entre un grupo poblado y uno en cero en la vista de grupos.

const partidos = require("./partidos-mundial");

const MARCADORES_1 = [2, 1, 0, 3, 1, 2];
const MARCADORES_2 = [0, 1, 1, 1, 2, 2];

module.exports = partidos
  .filter((p) => !p.id.startsWith("wc-L-"))
  .map((p, i) => ({
    partidoId: p.id,
    golesEquipo1Predicho: MARCADORES_1[i % MARCADORES_1.length],
    golesEquipo2Predicho: MARCADORES_2[i % MARCADORES_2.length],
  }));
