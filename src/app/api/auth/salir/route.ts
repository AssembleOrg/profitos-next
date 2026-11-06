import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolvePublicOrigin } from "@/lib/server/public-origin";

/**
 * Destino de una sesión cerrada desde otro dispositivo: borra las cookies de
 * Supabase de este navegador y vuelve al login con aviso. Sin esto, el proxy
 * vería la cookie viva y mandaría /login → /dashboard en bucle.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  // Si Supabase no respondió, signOut no limpia: borrar las cookies a mano.
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name.startsWith("sb-")) store.delete(c.name);
  }

  const origin = resolvePublicOrigin(request.headers);
  return NextResponse.redirect(`${origin}/login?error=sesion_cerrada`);
}
