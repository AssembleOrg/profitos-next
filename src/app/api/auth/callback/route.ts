import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailWhitelisted } from "@/lib/auth/whitelist";
import { upsertUser } from "@/lib/auth/user-service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] exchangeCodeForSession error:", error.message);
    }

    if (!error && data.user) {
      const whitelisted = await isEmailWhitelisted(data.user.email!);

      if (!whitelisted) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=not_whitelisted`
        );
      }

      await upsertUser({
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name ?? null,
        avatarUrl: data.user.user_metadata?.avatar_url ?? null,
        googleAccessToken: data.session?.provider_token ?? null,
        googleRefreshToken: data.session?.provider_refresh_token ?? null,
      });

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  const reason = code ? "code_exchange_failed" : "no_code";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}
