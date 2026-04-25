import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const emails = [
    "julychaves17@gmail.com",
    "profitospropiedades@gmail.com",
  ];

  for (const email of emails) {
    await prisma.whitelist.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, isActive: true },
    });
    console.log(`✓ Whitelisted: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
