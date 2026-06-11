/**
 * send-test-notification.js
 *
 * Sends a one-off push notification to a specific user (by email or username).
 *
 * Usage:
 *   node scripts/send-test-notification.js
 *   node scripts/send-test-notification.js --user mateomarenco74@gmail.com
 *   node scripts/send-test-notification.js --user mateomarenco74@gmail.com --lang en
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { prisma } = require("../src/config/prisma");
const { sendNotification } = require("../src/services/push.service");

const args = process.argv.slice(2);
const userArg =
  args[args.indexOf("--user") + 1] ?? "mateomarenco74@gmail.com";
const langArg =
  (args[args.indexOf("--lang") + 1] ?? "").toLowerCase() || null;

const MESSAGES = {
  es: {
    title: "¡El Mundial arranca mañana!",
    body:  "No te olvides de cargar tus predicciones antes del primer partido. ¡Buena suerte!",
  },
  en: {
    title: "FIFA World Cup starts tomorrow!",
    body:  "Don't forget to make your predictions before the first match. Good luck!",
  },
};

async function main() {
  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ email: userArg }, { username: userArg }] },
    include: { expoTokens: true },
  });

  if (!usuario) {
    console.error(`User not found: ${userArg}`);
    process.exit(1);
  }

  if (!usuario.expoTokens.length) {
    console.error(
      `User "${usuario.username}" has no Expo push tokens in the DB.\n` +
      "They need to log in with the app (after the push registration fix is deployed) first."
    );
    process.exit(1);
  }

  const lang = langArg ?? usuario.idioma ?? "es";
  const payload = MESSAGES[lang] ?? MESSAGES.es;

  console.log(`Sending to user: ${usuario.username} (${usuario.email ?? "no email"})`);
  console.log(`Tokens: ${usuario.expoTokens.length}`);
  console.log(`Lang: ${lang}`);
  console.log(`Title: ${payload.title}`);
  console.log(`Body:  ${payload.body}\n`);

  let sent = 0, failed = 0;
  for (const { token } of usuario.expoTokens) {
    const result = await sendNotification(token, payload);
    if (result.sent) {
      sent++;
      console.log(`  ✔ sent to ${token}`);
    } else {
      failed++;
      console.log(`  ✖ failed (${result.reason}) for ${token}`);
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
