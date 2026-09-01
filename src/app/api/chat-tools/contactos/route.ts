import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth } from "@/lib/api/chat-tools";
import { getInboxMessages } from "@/lib/messages/inbox";

// Tool del chat IA: últimos contactos de la central de mensajes (solo lectura).
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const estado = (sp.get("estado") ?? "nuevos").trim();
  const portal = (sp.get("portal") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number.parseInt(sp.get("limite") ?? "10", 10) || 10));

  const { items, total, counts } = await getInboxMessages({ estado, portal, page: 1, limit });

  // Conteos por estado de gestión (para el resumen del bot).
  const cases = await prisma.contactCase.groupBy({ by: ["status"], _count: true });
  const porEstado: Record<string, number> = { tomado: 0, espera: 0, descartado: 0 };
  for (const c of cases) porEstado[c.status] = c._count;

  const contactos = items.map((m) => ({
    nombre: m.name,
    portal: m.portal,
    propiedad: m.propertyAddress ?? m.propertyTitle,
    mensaje: m.message ? m.message.slice(0, 180) : null,
    telefono: m.phone,
    email: m.email,
    fecha: m.date,
    estado: m.caseStatus ?? "nuevo",
    atiende: m.takenByName,
  }));

  return ok(
    { totalFiltrado: total, porPortal: counts, gestion: porEstado, contactos },
    "Contactos",
    request.nextUrl.pathname
  );
});
