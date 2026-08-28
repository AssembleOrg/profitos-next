import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ContactosClient } from "./_components/contactos-client";
import type { NoteAttachment } from "@/components/notes/media-uploader";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
  }>;
}

export default async function ContactosPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = (sp.q ?? "").trim();

  const clientWhere = user.role === "admin" ? {} : { userId: user.id };
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...clientWhere,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      include: { _count: { select: { visitas: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({
      where: {
        ...clientWhere,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
    }),
  ]);

  const serializedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    attachments: (c.attachments as NoteAttachment[] | null) ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: c._count,
  }));

  return (
    <ContactosClient
      clients={serializedClients}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      filters={{ q }}
    />
  );
}
