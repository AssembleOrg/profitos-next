"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ERRORS } from "@/lib/domain/types";
import { resolvePublicOrigin } from "@/lib/server/public-origin";

export interface LoginState {
  error?: string;
}

export async function signInWithGoogle(): Promise<LoginState> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = resolvePublicOrigin(headersList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      scopes: "https://www.googleapis.com/auth/calendar.events",
      queryParams: {
        access_type: "offline",
        include_granted_scopes: "true",
      },
    },
  });

  if (error || !data.url) {
    return { error: AUTH_ERRORS.OAUTH_ERROR };
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
