require("dotenv/config");

const { syncExternalCompetitions } = require("../src/services/externalCompetitionSync.service");
const { prisma } = require("../src/config/prisma");

syncExternalCompetitions()
  .then((summary) => {
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
  })
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      status: error.status,
      body: error.body,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
