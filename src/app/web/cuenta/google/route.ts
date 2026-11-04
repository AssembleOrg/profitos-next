import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { verifyGoogleToken } from "@/lib/web/server/google-token";
import { buildEvents, linkAnonymousHistory, saveEvents } from "@/lib/web/server/ingest";
import { isSameOrigin } from "@/lib/web/server/same-origin";
import { googleWebClientId, NONCE_COOKIE, startVisitorSession } from "@/lib/web/server/visitor-session";
import { toVisitorView } from "@/lib/web/server/visitor-view";

/** Certificados de prueba: solo con ambas variables cargadas, y nunca en Railway. */
function testCertsUrl(): string | undefined {
  return process.env.WEB_AUTH_TEST === "1" && !process.env.RAILWAY_ENVIRONMENT ? process.env.WEB_AUTH_TEST_CERTS_URL : undefined;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const clientId = googleWebClientId();
  if (!clientId) return NextResponse.json({ error: "Ingreso no disponible" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { credential?: unknown; anonId?: unknown; sessionId?: unknown; marketing?: unknown } | null;
  if (typeof body?.credential !== "string") return NextResponse.json({ error: "Falta el token" }, { status: 400 });

  const store = await cookies();
  const profile = await verifyGoogleToken(body.credential, {
    clientId,
    nonce: store.get(NONCE_COOKIE)?.value ?? "",
    certsUrl: testCertsUrl(),
  });
  if (!profile) return NextResponse.json({ error: "No pudimos validar tu cuenta de Google" }, { status: 401 });
  store.delete(NONCE_COOKIE);

  // La gente del equipo que navega la web no cuenta en las métricas.
  const internal = await prisma.whitelist.findUnique({ where: { email: profile.email }, select: { id: true } });
  const now = new Date();
  const marketing = body.marketing === true;
  const visitor = await prisma.webVisitor.upsert({
    where: { googleSub: profile.sub },
    create: {
      googleSub: profile.sub,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.picture,
      loginCount: 1,
      termsAcceptedAt: now,
      marketingConsent: marketing,
      isInternal: Boolean(internal),
    },
    update: {
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.picture,
      loginCount: { increment: 1 },
      lastLoginAt: now,
      isInternal: Boolean(internal),
      ...(marketing ? { marketingConsent: true } : {}),
    },
  });
  await startVisitorSession(visitor.id);

  const ID = /^[\w-]{8,64}$/;
  if (typeof body.anonId === "string" && ID.test(body.anonId)) {
    await linkAnonymousHistory(body.anonId, visitor.id);
    const sessionId = typeof body.sessionId === "string" && ID.test(body.sessionId) ? body.sessionId : body.anonId;
    const events = await buildEvents(
      [{ id: `login-${visitor.id}-${visitor.loginCount}`, type: "login", label: visitor.loginCount === 1 ? "primer ingreso" : "reingreso" }],
      { anonId: body.anonId, sessionId, visitorId: visitor.id, userAgent: request.headers.get("user-agent") ?? "", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    );
    await saveEvents(events);
  }
  return NextResponse.json({ visitor: toVisitorView(visitor) });
}
