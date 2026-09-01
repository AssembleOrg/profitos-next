import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth } from "@/lib/api/chat-tools";

// Tool del chat IA: seguimientos de propiedades (solo lectura).
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const soloVencidos = sp.get("vencidos") === "true";
  const email = (sp.get("responsableEmail") ?? "").trim();
  const limit = Math.min(30, Math.max(1, Number.parseInt(sp.get("limite") ?? "15", 10) || 15));

  const and: object[] = [{ status: { notIn: ["hecho", "cancelado"] } }];
  if (soloVencidos) and.push({ dueDate: { lt: new Date() } });
  if (email) and.push({ assignedToUser: { email: { equals: email, mode: "insensitive" } } });

  const rows = await prisma.propertyFollowUp.findMany({
    where: { AND: and },
    select: {
      title: true,
      status: true,
      dueDate: true,
      notes: true,
      property: { select: { address: true } },
      assignedToUser: { select: { fullName: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const seguimientos = rows.map((r) => ({
    propiedad: r.property.address,
    titulo: r.title,
    estado: r.status,
    vence: r.dueDate,
    responsable: r.assignedToUser.fullName?.trim() || r.assignedToUser.email,
    notas: r.notes ? r.notes.slice(0, 150) : null,
  }));

  return ok({ cantidad: seguimientos.length, seguimientos }, "Seguimientos", request.nextUrl.pathname);
});
