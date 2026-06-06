/**
 * world-cup-2026.js
 * Composición oficial de los grupos de la Copa Mundial FIFA 2026 (sorteo final).
 *
 * Estructura: { "A": [equipo1, equipo2, equipo3, equipo4], ... } con 12 grupos (A–L).
 * Los nombres están en español para coincidir con los equipos del backend
 * (las selecciones se guardan como "Argentina", "Brasil", "España", ...).
 *
 * Grupos actualizados con los ganadores de repechaje definidos.
 */
const WORLD_CUP_2026_GROUPS = {
  A: ['México', 'Sudáfrica', 'Corea del Sur', 'República Checa'],
  B: ['Canadá', 'Suiza', 'Catar', 'Bosnia y Herzegovina'],
  C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  D: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquía'],
  E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
  F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
  G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  H: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'],
  I: ['Francia', 'Senegal', 'Noruega', 'Irak'],
  J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
  K: ['Portugal', 'Colombia', 'Uzbekistán', 'RD Congo'],
  L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
};

// Slug de la competencia del Mundial en el backend (ver prisma/seed/data/competencias.js).
const WORLD_CUP_2026_SLUG = 'copa-mundial-fifa';

/**
 * Nombres en inglés para mostrar cuando el idioma activo es 'en'.
 * La clave es el nombre canónico en español (el que usa el backend y
 * WORLD_CUP_2026_GROUPS); se traduce solo para mostrar, no para el matching.
 */
const WORLD_CUP_2026_TEAM_NAMES_EN = {
  'México': 'Mexico',
  'Sudáfrica': 'South Africa',
  'Corea del Sur': 'South Korea',
  'República Checa': 'Czech Republic',
  'Canadá': 'Canada',
  'Suiza': 'Switzerland',
  'Catar': 'Qatar',
  'Bosnia y Herzegovina': 'Bosnia and Herzegovina',
  'Brasil': 'Brazil',
  'Marruecos': 'Morocco',
  'Haití': 'Haiti',
  'Escocia': 'Scotland',
  'Estados Unidos': 'United States',
  'Paraguay': 'Paraguay',
  'Australia': 'Australia',
  'Turquía': 'Türkiye',
  'Alemania': 'Germany',
  'Curazao': 'Curaçao',
  'Costa de Marfil': 'Ivory Coast',
  'Ecuador': 'Ecuador',
  'Países Bajos': 'Netherlands',
  'Japón': 'Japan',
  'Suecia': 'Sweden',
  'Túnez': 'Tunisia',
  'Bélgica': 'Belgium',
  'Egipto': 'Egypt',
  'Irán': 'Iran',
  'Nueva Zelanda': 'New Zealand',
  'España': 'Spain',
  'Cabo Verde': 'Cape Verde',
  'Arabia Saudí': 'Saudi Arabia',
  'Uruguay': 'Uruguay',
  'Francia': 'France',
  'Senegal': 'Senegal',
  'Noruega': 'Norway',
  'Irak': 'Iraq',
  'Argentina': 'Argentina',
  'Argelia': 'Algeria',
  'Austria': 'Austria',
  'Jordania': 'Jordan',
  'Portugal': 'Portugal',
  'Colombia': 'Colombia',
  'Uzbekistán': 'Uzbekistan',
  'RD Congo': 'DR Congo',
  'Inglaterra': 'England',
  'Croacia': 'Croatia',
  'Ghana': 'Ghana',
  'Panamá': 'Panama',
};
