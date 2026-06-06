// Fase de grupos de la Copa Mundial FIFA 2026.
// Se generan los round-robin (6 partidos) de los 12 grupos oficiales. Los
// nombres deben coincidir con equipos.js y con js/world-cup-2026.js (frontend).

const GRUPOS = {
  A: ["México", "Sudáfrica", "Corea del Sur", "República Checa"],
  B: ["Canadá", "Suiza", "Catar", "Bosnia y Herzegovina"],
  C: ["Brasil", "Marruecos", "Haití", "Escocia"],
  D: ["Estados Unidos", "Paraguay", "Australia", "Turquía"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Países Bajos", "Japón", "Suecia", "Túnez"],
  G: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
  H: ["España", "Cabo Verde", "Arabia Saudí", "Uruguay"],
  I: ["Francia", "Senegal", "Noruega", "Irak"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Colombia", "Uzbekistán", "RD Congo"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panamá"],
};

// Emparejamientos de un round-robin de 4 equipos (3 fechas).
const PARES = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

const BASE = Date.UTC(2026, 5, 15, 18, 0, 0); // 2026-06-15 (futuro respecto al "hoy" del entorno)
const DIA_MS = 86400000;

const partidos = [];
let offset = 0;
for (const [letra, equipos] of Object.entries(GRUPOS)) {
  PARES.forEach((par, i) => {
    partidos.push({
      id: `wc-${letra}-${i + 1}`,
      competenciaSlug: "copa-mundial-fifa",
      equipo1: equipos[par[0]],
      equipo2: equipos[par[1]],
      fecha: new Date(BASE + offset * DIA_MS).toISOString(),
      estado: "PROGRAMADO",
      equipo1EsLocal: true,
    });
    offset++;
  });
}

module.exports = partidos;