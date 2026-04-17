import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { MiembrosClient } from "./_components/miembros-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function MiembrosPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));

  const [whitelistItems, total] = await Promise.all([
    prisma.whitelist.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whitelist.count(),
  ]);

  const emails = whitelistItems.map((w) => w.email.toLowerCase());
  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { email: true, fullName: true, role: true, avatarUrl: true },
  });

  const usersByEmail = new Map(
    users.map((u) => [u.email.toLowerCase(), u])
  );

  const serialized = whitelistItems.map((e) => {
    const matchedUser = usersByEmail.get(e.email.toLowerCase());
    return {
      id: e.id,
      email: e.email,
      isActive: e.isActive,
      createdAt: e.createdAt.toISOString(),
      fullName: matchedUser?.fullName ?? null,
      role: (matchedUser?.role as "admin" | "user" | "viewer") ?? (e.defaultRole as "admin" | "user" | "viewer"),
      avatarUrl: matchedUser?.avatarUrl ?? null,
      hasAccount: !!matchedUser,
    };
  });

  return (
    <MiembrosClient
      items={serialized}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
    />
  );
}
