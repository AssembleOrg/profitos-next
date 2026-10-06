import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Exponer el pathname a los Server Components (lo lee el layout protegido
  // para bloquear rutas a las que el usuario no tiene acceso).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates JWT server-side (not getSession which only parses locally)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If a Supabase auth code arrives at any path, forward it to the callback handler
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/api/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/callback";
    return NextResponse.redirect(url);
  }

  const path = request.nextUrl.pathname;
  const isPortal = path === "/portal" || path.startsWith("/portal/");
  const isPortalLogin = path === "/portal/login";
  // Portal de inquilinos: cuenta email + contraseña marcada en app_metadata.
  const isTenant = user?.app_metadata?.kind === "tenant";

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (isPortal) {
    if (!user && !isPortalLogin) return redirectTo("/portal/login");
    if (user && isPortalLogin) return redirectTo(isTenant ? "/portal" : "/dashboard");
    if (user && !isTenant) return redirectTo("/dashboard");
    return supabaseResponse;
  }

  // Un inquilino logueado nunca entra a las pantallas del staff.
  if (isTenant) return redirectTo("/portal");

  if (!user && !path.startsWith("/login") && !path.startsWith("/api/auth")) {
    return redirectTo("/login");
  }

  if (user && path.startsWith("/login")) {
    return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
