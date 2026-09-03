import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type AppPrismaClient = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

function createPrismaClient(): AppPrismaClient {
  // Runtime usa el pooler transaction-mode (DATABASE_URL, :6543, pgbouncer),
  // que tolera muchos clientes. DIRECT_URL (:5432 session-mode, pool_size 15)
  // es solo para migraciones (schema.prisma directUrl) y queda como fallback.
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL!;
  const schemaFromUrl = (() => {
    try {
      return new URL(connectionString).searchParams.get("schema") ?? undefined;
    } catch {
      return undefined;
    }
  })();

  const adapter = new PrismaPg(
    // max: tope defensivo de conexiones por instancia del proceso.
    { connectionString, max: 10 },
    { schema: schemaFromUrl }
  );

  return new PrismaClient({ adapter });
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export const prisma = globalForPrisma.prisma;
