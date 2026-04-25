import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getProposalOrThrow } from "@/lib/api/signatures";
import type { Prisma } from "@/generated/prisma/client";

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getProposalOrThrow(id);
  const body = await request.json();
  const { description, attachments } = body as {
    description?: string;
    attachments?: unknown[];
  };

  const cleanDescription = description?.trim() ?? "";
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!cleanDescription && !hasAttachments) {
    throw new AppError(400, "La nota no puede estar vacía (texto o adjuntos)");
  }

  const action = await prisma.signatureProposalAction.create({
    data: {
      proposalId: id,
      type: "nota",
      description: cleanDescription || null,
      attachments: hasAttachments ? (attachments as Prisma.InputJsonValue) : undefined,
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  });

  // Touch parent so updatedAt refreshes for sorting
  await prisma.signatureProposal.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return created(action, "Nota agregada correctamente", path);
});
