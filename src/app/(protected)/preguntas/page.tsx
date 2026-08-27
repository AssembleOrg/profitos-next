import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { PreguntasClient } from "./_components/preguntas-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}

export default async function PreguntasPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const status = (sp.status ?? "UNANSWERED").toUpperCase();
  const q = (sp.q ?? "").trim();

  const and: Prisma.PortalQuestionWhereInput[] = [{ portal: "mercadolibre" }];
  if (status === "UNANSWERED" || status === "ANSWERED") and.push({ status });
  if (q) and.push({ text: { contains: q, mode: "insensitive" } });
  const where: Prisma.PortalQuestionWhereInput = { AND: and };

  const [questions, total, unansweredCount] = await Promise.all([
    prisma.portalQuestion.findMany({
      where,
      orderBy: [{ askedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.portalQuestion.count({ where }),
    prisma.portalQuestion.count({ where: { portal: "mercadolibre", status: "UNANSWERED" } }),
  ]);

  // Direcciones de las propiedades vinculadas (sin FK: lookup por id).
  const propertyIds = [...new Set(questions.map((x) => x.propertyId).filter(Boolean))] as string[];
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, address: true, publicUrl: true },
      })
    : [];
  const propMap = new Map(properties.map((p) => [p.id, p]));

  const items = questions.map((x) => ({
    id: x.id,
    text: x.text,
    status: x.status,
    answerText: x.answerText,
    itemId: x.itemId,
    askedAt: x.askedAt?.toISOString() ?? null,
    answeredAt: x.answeredAt?.toISOString() ?? null,
    propertyId: x.propertyId,
    propertyAddress: x.propertyId ? propMap.get(x.propertyId)?.address ?? null : null,
    permalink: x.propertyId ? propMap.get(x.propertyId)?.publicUrl ?? null : null,
  }));

  return (
    <PreguntasClient
      items={items}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      total={total}
      unansweredCount={unansweredCount}
      filters={{ status, q }}
    />
  );
}
