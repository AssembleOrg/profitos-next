import { prisma } from "@/lib/prisma/client";

export type Responsible = { userId: number; name: string; lastName: string; email: string };

/** Lee la lista cacheada de responsables de un portal (para el selector). */
export async function getResponsibles(portal: string): Promise<Responsible[]> {
  const row = await prisma.portalResponsibles.findUnique({ where: { portal } });
  return (row?.users as Responsible[] | undefined) ?? [];
}

/** Normaliza userWithPermissions de ZonaProp (STEP_PLAN_SELECTION) a la lista. */
export function normalizeResponsibles(userWithPermissions: unknown): Responsible[] {
  if (!Array.isArray(userWithPermissions)) return [];
  const out: Responsible[] = [];
  for (const u of userWithPermissions) {
    if (!u || typeof u !== "object") continue;
    const o = u as Record<string, unknown>;
    const userId = Number(o.userId);
    if (!Number.isFinite(userId)) continue;
    out.push({
      userId,
      name: String(o.name ?? ""),
      lastName: String(o.lastName ?? ""),
      email: String(o.email ?? ""),
    });
  }
  return out;
}

/** Cachea la lista de responsables (la refresca el worker al publicar). */
export async function saveResponsibles(portal: string, users: Responsible[]): Promise<void> {
  if (!users.length) return;
  await prisma.portalResponsibles.upsert({
    where: { portal },
    create: { portal, users, fetchedAt: new Date() },
    update: { users, fetchedAt: new Date() },
  });
}
