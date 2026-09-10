import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { config } from "./config";

/**
 * Seed the first admin user (idempotent). Everyone else is created by an
 * admin via POST /api/auth/register.
 */
async function main() {
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  const user = await prisma.user.upsert({
    where: { email: config.adminEmail },
    update: {},
    create: { name: "Admin", email: config.adminEmail, passwordHash, role: "admin" },
  });
  console.log(`Seeded admin user: ${user.email} (${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
