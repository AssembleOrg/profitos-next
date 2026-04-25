import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { signatureInclude } from "@/lib/api/signatures";
import { isSignatureStatus } from "@/lib/signatures";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const propertyId = sp.get("propertyId")?.trim();
  const status = sp.get("status")?.trim();
  const q = sp.get("q")?.trim();
  const createdByUserId = sp.get("createdByUserId")?.trim();

  const where: Prisma.SignatureProposalWhereInput = {};

  if (propertyId) where.propertyId = propertyId;
  if (status && isSignatureStatus(status)) where.status = status;
  if (createdByUserId) where.createdByUserId = createdByUserId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.signatureProposal.findMany({
      where,
      include: signatureInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.signatureProposal.count({ where }),
  ]);

  const result = buildPaginatedResult(items, total, page, limit);
  return paginated(result, "Firmas obtenidas correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();

  const body = await request.json();
  const {
    propertyId,
    title,
    description,
    attachments,
    status,
  } = body as {
    propertyId?: string;
    title?: string;
    description?: string;
    attachments?: unknown[];
    status?: string;
  };

  if (!propertyId) throw new AppError(400, "Falta el campo 'propertyId'");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, address: true },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const initialStatus = status && isSignatureStatus(status) ? status : "propuesta_enviada";

  const proposal = await prisma.signatureProposal.create({
    data: {
      propertyId,
      title: title?.trim() || null,
      description: description?.trim() || null,
      attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
      status: initialStatus,
      createdByUserId: auth.userId,
      actions: {
        create: {
          type: "creation",
          toStatus: initialStatus,
          description: title?.trim() || "Propuesta creada",
          attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
          createdByUserId: auth.userId,
        },
      },
    },
    include: signatureInclude,
  });

  return created(proposal, "Propuesta creada correctamente", path);
});
