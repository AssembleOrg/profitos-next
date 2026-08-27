import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/api/auth";
import { buildAuthUrl, generatePkce } from "@/lib/mercadolibre/oauth";

// Inicia el flujo OAuth (authorization_code + PKCE): redirige al authorize de ML.
export async function GET(request: NextRequest) {
  await getAuthContext(); // solo usuarios autenticados pueden conectar

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generatePkce();
  let url: string;
  try {
    url = buildAuthUrl(state, challenge);
  } catch (err) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.redirect(`${base}/propiedades?ml_error=${encodeURIComponent(msg)}`);
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  const res = NextResponse.redirect(url);
  res.cookies.set("ml_oauth_state", state, cookieOpts);
  res.cookies.set("ml_oauth_verifier", verifier, cookieOpts);
  return res;
}
