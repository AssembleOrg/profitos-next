"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ERRORS } from "@/lib/domain/types";
import { resolvePublicOrigin } from "@/lib/server/public-origin";
import { getDeviceSession, revokeSession } from "@/lib/auth/device-sessions";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Queda en el historial de Dispositivos como cerrada.
    const device = await getDeviceSession(user.id).catch(() => null);
    if (device?.status === "ok") await revokeSession(user.id, device.sessionId).catch(() => undefined);
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
