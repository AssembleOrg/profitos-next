"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isEmailWhitelisted } from "@/lib/auth/whitelist";
import { upsertUser } from "@/lib/auth/user-service";
import { AUTH_ERRORS } from "@/lib/domain/types";

export interface LoginState {
  error?: string;
}

export async function signInWithEmail(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  const whitelisted = await isEmailWhitelisted(data.user.email!);
  if (!whitelisted) {
    await supabase.auth.signOut();
    return { error: AUTH_ERRORS.NOT_WHITELISTED };
  }

  await upsertUser({
    id: data.user.id,
    email: data.user.email!,
    fullName: data.user.user_metadata?.full_name ?? null,
    avatarUrl: data.user.user_metadata?.avatar_url ?? null,
  });

  redirect("/dashboard");
}

export async function signInWithGoogle(): Promise<LoginState> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      scopes: "https://www.googleapis.com/auth/calendar.events",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
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
