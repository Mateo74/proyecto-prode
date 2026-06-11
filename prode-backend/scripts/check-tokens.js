require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { prisma } = require("../src/config/prisma");

async function main() {
  const user = await prisma.usuario.findFirst({
    where: { OR: [{ email: "mateomarenco74@gmail.com" }, { username: "mateomarenco" }] },
    include: { expoTokens: true },
  });
  if (!user) { console.log("User not found"); return; }
  console.log("User:", user.username, "|", user.email);
  console.log("Tokens:", user.expoTokens.length);
  user.expoTokens.forEach(t => console.log(" -", t.token, "| created:", t.createdAt));
}

main().catch(console.error).finally(() => prisma.$disconnect());
