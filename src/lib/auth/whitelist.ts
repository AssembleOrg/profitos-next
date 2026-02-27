import { prisma } from "@/lib/prisma/client";

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const entry = await prisma.whitelist.findUnique({
    where: { email: email.toLowerCase() },
    select: { isActive: true },
  });

  return entry?.isActive === true;
}
