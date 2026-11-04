import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isSameOrigin } from "@/lib/web/server/same-origin";
import { currentVisitorId } from "@/lib/web/server/visitor-session";

const KEY = /^[\w-]{1,40}$/;

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const id = await currentVisitorId();
  if (!id) return new NextResponse(null, { status: 401 });
  const body = (await request.json().catch(() => null)) as { favorites?: unknown } | null;
  if (!Array.isArray(body?.favorites)) return new NextResponse(null, { status: 400 });
  const favorites = [...new Set(body.favorites.filter((key): key is string => typeof key === "string" && KEY.test(key)))].slice(0, 300);
  await prisma.webVisitor.update({ where: { id }, data: { favorites } });
  return new NextResponse(null, { status: 204 });
}
