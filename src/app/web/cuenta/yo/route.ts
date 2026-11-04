import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { currentVisitorId } from "@/lib/web/server/visitor-session";
import { toVisitorView } from "@/lib/web/server/visitor-view";

export async function GET() {
  const id = await currentVisitorId();
  const visitor = id ? await prisma.webVisitor.findUnique({ where: { id } }) : null;
  return NextResponse.json({ visitor: visitor ? toVisitorView(visitor) : null }, { headers: { "cache-control": "no-store" } });
}
