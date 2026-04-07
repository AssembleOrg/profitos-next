import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type AppPrismaClient = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

function createPrismaClient(): AppPrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const schemaFromUrl = (() => {
    try {
      return new URL(connectionString).searchParams.get("schema") ?? undefined;
    } catch {
      return undefined;
    }
  })();

  const adapter = new PrismaPg(
    { connectionString },
    { schema: schemaFromUrl }
  );

  return new PrismaClient({ adapter });
}

export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ?? createPrismaClient())
    : createPrismaClient();

if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma = prisma;
}
