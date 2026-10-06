"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AGENCY_WHATSAPP = "5491153854029";

export function PortalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err || !data.user) {
      setLoading(false);
      setError(/invalid/i.test(err?.message ?? "") ? "El email o la contraseña no coinciden." : "No pudimos iniciar sesión. Probá de nuevo en un rato.");
      return;
    }
    if (data.user.app_metadata?.kind !== "tenant") {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Esta cuenta no es de inquilino. El equipo entra por el acceso de la inmobiliaria.");
      return;
    }
    router.replace("/portal");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h2 className="font-display text-[22px] font-semibold text-text">Portal de inquilinos</h2>
        <p className="mt-1 text-[13px] text-text-muted">Entrá con el email y la contraseña que te pasó la inmobiliaria.</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-text-muted">Email</span>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-[14px] border border-border bg-surface px-3.5 text-[15px] text-text outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-text-muted">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-[14px] border border-border bg-surface px-3.5 text-[15px] text-text outline-none focus:border-accent"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-[12px] bg-clay-chip px-3.5 py-2.5 text-[13px] text-terra">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-dark text-[14px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-[12.5px] text-text-faint">
        ¿No tenés acceso u olvidaste la contraseña?{" "}
        <a
          href={`https://wa.me/${AGENCY_WHATSAPP}?text=${encodeURIComponent("Hola, necesito acceso al portal de inquilinos.")}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-terra hover:underline"
        >
          Escribinos
        </a>
      </p>
    </form>
  );
}
