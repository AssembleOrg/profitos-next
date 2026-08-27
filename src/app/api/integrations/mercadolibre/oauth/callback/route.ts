import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mercadolibre/oauth";

// Callback del OAuth de ML: canjea el code por tokens y vuelve a /propiedades.
export async function GET(request: NextRequest) {
  // En Railway/proxies, request.nextUrl.origin puede ser el host interno
  // (localhost:8080). Preferimos la URL pública configurada.
  const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  const back = (params: string) => NextResponse.redirect(`${base}/propiedades?${params}`);

  if (error) {
    return back(`ml_error=${encodeURIComponent(sp.get("error_description") ?? error)}`);
  }

  const expectedState = request.cookies.get("ml_oauth_state")?.value;
  const verifier = request.cookies.get("ml_oauth_verifier")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("ml_error=" + encodeURIComponent("Estado OAuth inválido, reintentá."));
  }
  if (!verifier) {
    return back("ml_error=" + encodeURIComponent("Falta el verificador PKCE, reintentá la conexión."));
  }

  try {
    await exchangeCode(code, verifier);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al conectar";
    return back("ml_error=" + encodeURIComponent(msg));
  }

  const res = back("ml_connected=1");
  res.cookies.delete("ml_oauth_state");
  res.cookies.delete("ml_oauth_verifier");
  return res;
}
