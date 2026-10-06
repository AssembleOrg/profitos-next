"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalHeader({ name }: { name: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/portal/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3.5 md:px-8">
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.42em] text-text">JULIANA PROFITOS</p>
          <p className="text-[7.5px] uppercase tracking-[0.4em] text-text-faint">Propiedades</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[12.5px] text-text-muted sm:inline">{name}</span>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
