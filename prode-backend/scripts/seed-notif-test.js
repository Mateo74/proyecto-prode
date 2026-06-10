/**
 * seed-notif-test.js
 * Creates a private test tournament with hourly matches for testing push notifications.
 *
 * Usage:
 *   node scripts/seed-notif-test.js
 *   node scripts/seed-notif-test.js --delete   # removes all test data created by this script
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD YOUR USERS HERE (by email or username — emails are tried first):
 */
const TEST_USERS = [
  "mateomarenco74@gmail.com",
  "pruebita"   // ← replace / add entries as needed
];
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The script creates:
 *   • 1 Competencia  (slug "notif-test", not visible)
 *   • 2 Equipos      (Alpha FC, Beta FC)
 *   • 72 Partidos    hourly from FIRST_MATCH_UTC (3 days), estado PROGRAMADO
 *   • 1 TorneoDeAmigos  (private, only TEST_USERS are members)
 *
 * The tournament won't appear in any global list or search — only the users
 * listed above will see it in their "Torneos de amigos" page.
 *
 * Safe to re-run: uses upsert / findFirst guards everywhere.
 */

require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const FIRST_MATCH_UTC = new Date("2026-06-09T16:00:00Z");
const MATCH_COUNT = 72; // one per hour for 3 days
const HOUR_MS = 60 * 60 * 1000;

const COMP_SLUG    = "notif-test";
const COMP_NOMBRE  = "Notif Test (do not publish)";
const TORNEO_NAME  = "Test Notificaciones";
const EQUIPO1_SLUG = "alpha-fc";
const EQUIPO2_SLUG = "beta-fc";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

async function main() {
  const isDelete = process.argv.includes("--delete");

  if (isDelete) {
    await deleteTestData();
  } else {
    await seedTestData();
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function deleteTestData() {
  const comp = await prisma.competencia.findUnique({ where: { slug: COMP_SLUG } });
  if (!comp) {
    console.log("No test data found (competencia not present) — nothing to delete.");
    return;
  }

  // Cascade via Prisma (predicciones & torneos will cascade from competencia)
  await prisma.competencia.delete({ where: { slug: COMP_SLUG } });

  // Teams are not linked to competencia — delete separately if still unused
  for (const slug of [EQUIPO1_SLUG, EQUIPO2_SLUG]) {
    const equipo = await prisma.equipo.findUnique({ where: { slug } });
    if (!equipo) continue;
    const usage = await prisma.partido.count({
      where: { OR: [{ equipo1Id: equipo.id }, { equipo2Id: equipo.id }] },
    });
    if (usage === 0) {
      await prisma.equipo.delete({ where: { slug } });
      console.log(`Deleted equipo: ${slug}`);
    } else {
      console.log(`Equipo ${slug} still has ${usage} partidos — skipped deletion.`);
    }
  }

  console.log("Test data deleted.");
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seedTestData() {
  // 1. Resolve users
  const users = [];
  for (const identifier of TEST_USERS) {
    const user = await prisma.usuario.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!user) {
      console.warn(`⚠️  User not found: "${identifier}" — skipping`);
    } else {
      users.push(user);
      console.log(`✓  Found user: ${user.username} (${user.email})`);
    }
  }
  if (!users.length) {
    console.error("No valid users found. Check TEST_USERS at the top of the script.");
    process.exit(1);
  }

  // 2. Competencia
  const competencia = await prisma.competencia.upsert({
    where: { slug: COMP_SLUG },
    update: { visible: true },
    create: {
      nombre: COMP_NOMBRE,
      nombreEn: "Notif Test (do not publish)",
      slug: COMP_SLUG,
      visible: true,    // visible so the torneo query finds it; access gated by frontend whitelist
      terminada: false,
    },
  });
  console.log(`✓  Competencia: ${competencia.nombre} (${competencia.id})`);

  // 3. Teams
  const equipo1 = await prisma.equipo.upsert({
    where: { slug: EQUIPO1_SLUG },
    update: {},
    create: { nombre: "Alpha FC", slug: EQUIPO1_SLUG, abreviatura: "ALP", tipo: "CLUB" },
  });
  const equipo2 = await prisma.equipo.upsert({
    where: { slug: EQUIPO2_SLUG },
    update: {},
    create: { nombre: "Beta FC",  slug: EQUIPO2_SLUG,  abreviatura: "BET", tipo: "CLUB" },
  });
  console.log(`✓  Equipos: ${equipo1.nombre}, ${equipo2.nombre}`);

  // 4. Matches — one per hour, alternating home/away
  const partidos = [];
  for (let i = 0; i < MATCH_COUNT; i++) {
    const fecha = new Date(FIRST_MATCH_UTC.getTime() + i * HOUR_MS);
    const extId  = `notif-test-match-${i + 1}`;
    const p = await prisma.partido.upsert({
      where: { proveedor_externalId: { proveedor: "notif-test", externalId: extId } },
      update: { fecha, estado: "PROGRAMADO" },
      create: {
        competenciaId: competencia.id,
        equipo1Id:     i % 2 === 0 ? equipo1.id : equipo2.id,
        equipo2Id:     i % 2 === 0 ? equipo2.id : equipo1.id,
        equipo1EsLocal: true,
        fecha,
        estado: "PROGRAMADO",
        proveedor: "notif-test",
        externalId: extId,
      },
    });
    console.log(`✓  Match ${i + 1}: ${fecha.toISOString()}`);
    partidos.push(p);
  }

  // 5. Tournament
  let torneo = await prisma.torneoDeAmigos.findFirst({
    where: { nombre: TORNEO_NAME, competenciaId: competencia.id, esGlobal: false },
    include: { usuarios: { select: { id: true } } },
  });

  if (!torneo) {
    torneo = await prisma.torneoDeAmigos.create({
      data: {
        nombre: TORNEO_NAME,
        competenciaId: competencia.id,
        esGlobal: false,
        activo: true,
        usuarios: { connect: users.map((u) => ({ id: u.id })) },
      },
      include: { usuarios: { select: { id: true } } },
    });
    console.log(`✓  Torneo created: "${torneo.nombre}" (${torneo.id})`);
  } else {
    // Add any new users that aren't already members
    const existingIds = new Set(torneo.usuarios.map((u) => u.id));
    const toAdd = users.filter((u) => !existingIds.has(u.id));
    if (toAdd.length) {
      await prisma.torneoDeAmigos.update({
        where: { id: torneo.id },
        data: { usuarios: { connect: toAdd.map((u) => ({ id: u.id })) } },
      });
      console.log(`✓  Added ${toAdd.length} new member(s) to existing torneo`);
    } else {
      console.log(`✓  Torneo already exists: "${torneo.nombre}" (${torneo.id}) — no changes`);
    }
  }

  console.log(`
Done.
  Competencia : ${competencia.id}
  Torneo      : ${torneo.id}
  Members     : ${users.map((u) => u.username).join(", ")}
  Matches     : ${MATCH_COUNT} × hourly from ${FIRST_MATCH_UTC.toISOString()}

The next notification job run will pick up any match falling in the 2h or 24h window.
Job runs every 15 min — trigger manually if needed via the /api/debug/notif-check endpoint (if enabled).
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
