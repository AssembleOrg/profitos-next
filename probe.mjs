import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });
const u = await p.user.findFirst({ where: { role: "admin" } });
console.log(u ? JSON.stringify({ id: u.id, email: u.email, fullName: u.fullName, role: u.role }) : "NO_ADMIN");
await p.$disconnect();
