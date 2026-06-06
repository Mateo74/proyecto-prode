require("dotenv/config");

const bcrypt = require("bcryptjs");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const competenciasData = require("./seed/data/competencias");
const equiposData = require("./seed/data/equipos");

const partidosLibertadores = require("./seed/data/partidos-libertadores");
const partidosLiga = require("./seed/data/partidos-liga-argentina");
const partidosMundial = require("./seed/data/partidos-mundial");
const prediccionesMundial = require("./seed/data/predicciones-mundial");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function upsertEquipo(nombre, abreviatura, nombreCompleto, tipo) {
  return prisma.equipo.upsert({
    where: { slug: slugify(nombre) },
    update: {
      nombre,
      abreviatura,
      nombreCompleto,
      tipo,
    },
    create: {
      nombre,
      abreviatura,
      nombreCompleto,
      tipo,
      slug: slugify(nombre),
    },
  });
}

async function main() {
  console.log("Seed iniciado");

  const hashClaveDemo = await bcrypt.hash("demo12345", 12);

  const usuario = await prisma.usuario.upsert({
    where: { username: "demo" },
    update: {},
    create: {
      nombre: "Usuario",
      apellido: "Demo",
      username: "demo",
      email: "demo@oncemetros.local",
      hashClave: hashClaveDemo,
    },
  });

  // COMPETENCIAS

  const competencias = {};

  for (const comp of competenciasData) {
    competencias[comp.slug] = await prisma.competencia.upsert({
      where: { slug: comp.slug },
      update: { nombre: comp.nombre, visible: comp.visible ?? false },
      create: comp,
    });
  }

  // EQUIPOS

  const equipos = {};

  for (const equipo of equiposData) {
    equipos[equipo[0]] = await upsertEquipo(...equipo);
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      hinchaDe: {
        connect: {
          id: equipos["Boca Juniors"].id,
        },
      },
    },
  });

  // PARTIDOS

  const partidos = [
    ...partidosLibertadores,
    ...partidosLiga,
    ...partidosMundial,
  ];

  for (const partido of partidos) {
    await prisma.partido.upsert({
      where: { id: partido.id },
      update: {
        competenciaId: competencias[partido.competenciaSlug].id,
        equipo1Id: equipos[partido.equipo1].id,
        equipo2Id: equipos[partido.equipo2].id,
        fecha: new Date(partido.fecha),
        estado: partido.estado,
        golesEquipo1: partido.golesEquipo1,
        golesEquipo2: partido.golesEquipo2,
        equipo1EsLocal: partido.equipo1EsLocal,
      },
      create: {
        id: partido.id,
        competenciaId: competencias[partido.competenciaSlug].id,
        equipo1Id: equipos[partido.equipo1].id,
        equipo2Id: equipos[partido.equipo2].id,
        fecha: new Date(partido.fecha),
        estado: partido.estado,
        golesEquipo1: partido.golesEquipo1,
        golesEquipo2: partido.golesEquipo2,
        equipo1EsLocal: partido.equipo1EsLocal,
      },
    });
  }

  // PREDICCIONES (usuario demo) — fase de grupos del Mundial
  for (const pred of prediccionesMundial) {
    await prisma.prediccion.upsert({
      where: {
        partidoId_usuarioId: {
          partidoId: pred.partidoId,
          usuarioId: usuario.id,
        },
      },
      update: {
        golesEquipo1Predicho: pred.golesEquipo1Predicho,
        golesEquipo2Predicho: pred.golesEquipo2Predicho,
      },
      create: {
        partidoId: pred.partidoId,
        usuarioId: usuario.id,
        golesEquipo1Predicho: pred.golesEquipo1Predicho,
        golesEquipo2Predicho: pred.golesEquipo2Predicho,
      },
    });
  }

  console.log("Seed listo");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });