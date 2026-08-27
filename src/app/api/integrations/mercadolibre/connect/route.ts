import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/api/auth";
import { buildAuthUrl } from "@/lib/mercadolibre/oauth";

// Inicia el flujo OAuth: redirige a la pantalla de autorización de ML.
export async function GET(request: NextRequest) {
  await getAuthContext(); // solo usuarios autenticados pueden conectar

  const state = randomBytes(16).toString("hex");
  let url: string;
  try {
    url = buildAuthUrl(state);
  } catch (err) {
    const base = request.nextUrl.origin;
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.redirect(`${base}/propiedades?ml_error=${encodeURIComponent(msg)}`);
  }

  const res = NextResponse.redirect(url);
  res.cookies.set("ml_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
