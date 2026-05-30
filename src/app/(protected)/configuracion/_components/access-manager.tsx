"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GRANTABLE_VIEWS } from "@/lib/nav/views";

interface Member {
  email: string;
  defaultRole: string;
  isActive: boolean;
  allowedViews: string[] | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export function AccessManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/configuracion/access", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      setMembers((body.data?.members ?? []) as Member[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los accesos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(email: string, nextViews: string[], prevViews: string[] | null) {
    setMembers((prev) => prev.map((m) => (m.email === email ? { ...m, allowedViews: nextViews } : m)));
    try {
      const res = await fetch("/api/configuracion/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, allowedViews: nextViews }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
    } catch (error) {
      // revertir
      setMembers((prev) => prev.map((m) => (m.email === email ? { ...m, allowedViews: prevViews } : m)));
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  function toggle(member: Member, href: string) {
    const current = member.allowedViews ?? [];
    const next = current.includes(href) ? current.filter((h) => h !== href) : [...current, href];
    void save(member.email, next, member.allowedViews);
  }

  function setAll(member: Member, all: boolean) {
    void save(member.email, all ? GRANTABLE_VIEWS.map((v) => v.href) : [], member.allowedViews);
  }

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return m.email.toLowerCase().includes(q) || (m.fullName ?? "").toLowerCase().includes(q);
  });

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-text">Acceso por usuario</h2>
        <p className="mt-1 text-xs text-text-muted">
          Elegí a qué vistas accede cada usuario. Los administradores ven todo. Un usuario nuevo arranca sin acceso
          hasta que le habilites vistas. Los cambios se guardan al instante.
        </p>
      </header>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por email o nombre…"
        className="mb-4 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
      />

      {loading ? (
        <p className="py-6 text-center text-sm text-text-muted">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Sin usuarios.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((m) => {
            const isAdmin = m.defaultRole === "admin";
            const allowed = new Set(m.allowedViews ?? []);
            return (
              <div key={m.email} className="rounded-xl border border-border bg-bg/40 p-3.5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-elevated text-xs font-semibold text-text-muted">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      (m.fullName ?? m.email).charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{m.fullName ?? m.email}</p>
                    {m.fullName && <p className="truncate text-xs text-text-muted">{m.email}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isAdmin ? "bg-olive-deep text-accent" : "bg-surface-elevated text-text-muted"
                    }`}
                  >
                    {m.defaultRole}
                  </span>
                </div>

                {isAdmin ? (
                  <p className="rounded-lg border border-border/60 bg-surface-elevated/30 px-3 py-2 text-xs text-text-muted">
                    Acceso total (administrador).
                  </p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAll(m, true)}
                        className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setAll(m, false)}
                        className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
                      >
                        Ninguna
                      </button>
                      <span className="ml-auto text-[11px] text-text-faint">
                        {allowed.size}/{GRANTABLE_VIEWS.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {GRANTABLE_VIEWS.map((v) => {
                        const on = allowed.has(v.href);
                        return (
                          <button
                            key={v.href}
                            type="button"
                            onClick={() => toggle(m, v.href)}
                            className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                              on
                                ? "border-olive-bright/40 bg-olive-deep/60 text-accent"
                                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text"
                            }`}
                          >
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
