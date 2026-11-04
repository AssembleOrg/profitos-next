import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/web/server/same-origin";
import { endVisitorSession } from "@/lib/web/server/visitor-session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  await endVisitorSession();
  return new NextResponse(null, { status: 204 });
}
