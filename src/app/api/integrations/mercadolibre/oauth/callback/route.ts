import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mercadolibre/oauth";

// Callback del OAuth de ML: canjea el code por tokens y vuelve a /propiedades.
export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin;
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  const back = (params: string) => NextResponse.redirect(`${base}/propiedades?${params}`);

  if (error) {
    return back(`ml_error=${encodeURIComponent(sp.get("error_description") ?? error)}`);
  }

  const expectedState = request.cookies.get("ml_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("ml_error=" + encodeURIComponent("Estado OAuth inválido, reintentá."));
  }

  try {
    await exchangeCode(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al conectar";
    return back("ml_error=" + encodeURIComponent(msg));
  }

  const res = back("ml_connected=1");
  res.cookies.delete("ml_oauth_state");
  return res;
}
