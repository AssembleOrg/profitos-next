import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { normalizeArgentinePhone } from "@/lib/web/phone";
import { isSameOrigin } from "@/lib/web/server/same-origin";
import { currentVisitorId } from "@/lib/web/server/visitor-session";

/** `seen` registra que se le pidió, para espaciar los recordatorios. `phone` lo guarda. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const id = await currentVisitorId();
  if (!id) return new NextResponse(null, { status: 401 });
  const body = (await request.json().catch(() => null)) as { phone?: unknown; seen?: unknown } | null;

  if (body?.seen === true) {
    await prisma.webVisitor.update({ where: { id }, data: { phoneAskCount: { increment: 1 }, phoneLastAskedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  }
  const phone = typeof body?.phone === "string" ? normalizeArgentinePhone(body.phone) : null;
  if (!phone) return NextResponse.json({ error: "Revisá el número: tiene que incluir la característica, por ejemplo 11 5385 4029." }, { status: 422 });
  await prisma.webVisitor.update({ where: { id }, data: { phone } });
  return new NextResponse(null, { status: 204 });
}
