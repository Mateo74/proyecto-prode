/**
 * For SELECCION teams from football-data:
 *  1. copies current nombre (English) → nombreEn
 *  2. sets nombre to Spanish translation
 *
 * Run: node scripts/translate-selecciones.js
 * Use --dry-run to preview without writing.
 */

const { prisma } = require('../src/config/prisma');

// key = current nombre (English, as stored), value = Spanish nombre
const ES = {
  'Algeria':        'Argelia',
  'Argentina':      'Argentina',
  'Australia':      'Australia',
  'Austria':        'Austria',
  'Belgium':        'Bélgica',
  'Bosnia-H.':      'Bosnia-H.',
  'Brazil':         'Brasil',
  'Canada':         'Canadá',
  'Cape Verde':     'Cabo Verde',
  'Colombia':       'Colombia',
  'Congo DR':       'Congo RD',
  'Croatia':        'Croacia',
  'Curaçao':        'Curaçao',
  'Czechia':        'Chequia',
  'Ecuador':        'Ecuador',
  'Egypt':          'Egipto',
  'England':        'Inglaterra',
  'France':         'Francia',
  'Germany':        'Alemania',
  'Ghana':          'Ghana',
  'Haiti':          'Haití',
  'Iran':           'Irán',
  'Iraq':           'Irak',
  'Ivory Coast':    'Costa de Marfil',
  'Japan':          'Japón',
  'Jordan':         'Jordania',
  'Korea Republic': 'Corea del Sur',
  'Mexico':         'México',
  'Morocco':        'Marruecos',
  'Netherlands':    'Países Bajos',
  'New Zealand':    'Nueva Zelanda',
  'Norway':         'Noruega',
  'Panama':         'Panamá',
  'Paraguay':       'Paraguay',
  'Portugal':       'Portugal',
  'Qatar':          'Qatar',
  'Saudi Arabia':   'Arabia Saudita',
  'Scotland':       'Escocia',
  'Senegal':        'Senegal',
  'South Africa':   'Sudáfrica',
  'Spain':          'España',
  'Sweden':         'Suecia',
  'Switzerland':    'Suiza',
  'Tunisia':        'Túnez',
  'Turkey':         'Turquía',
  'Uruguay':        'Uruguay',
  'USA':            'EE. UU.',
  'Uzbekistan':     'Uzbekistán',
};

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const teams = await prisma.equipo.findMany({
    where: { tipo: 'SELECCION', proveedor: 'football-data' },
    select: { id: true, nombre: true, nombreEn: true },
  });

  let updated = 0;
  let skipped = 0;
  let unknown = [];

  for (const team of teams) {
    const esName = ES[team.nombre];
    if (!esName) {
      unknown.push(team.nombre);
      continue;
    }

    console.log(`${team.nombre.padEnd(20)} → nombre: "${esName}", nombreEn: "${team.nombre}"`);

    if (!dryRun) {
      await prisma.equipo.update({
        where: { id: team.id },
        data: { nombre: esName, nombreEn: team.nombre },
      });
    }
    updated++;
  }

  if (unknown.length) {
    console.warn('\nNo translation found for:', unknown);
  }

  if (dryRun) {
    console.log(`\nDry run — ${updated} would be updated, ${skipped} skipped.`);
  } else {
    console.log(`\nDone — ${updated} updated, ${unknown.length} skipped (no translation).`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
