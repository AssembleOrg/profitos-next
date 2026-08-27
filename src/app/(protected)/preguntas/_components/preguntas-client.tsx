"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { formatDateTime } from "@/lib/datetime";

interface QuestionItem {
  id: string;
  text: string;
  status: string;
  answerText: string | null;
  itemId: string;
  askedAt: string | null;
  answeredAt: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  permalink: string | null;
}

interface Props {
  items: QuestionItem[];
  page: number;
  totalPages: number;
  total: number;
  unansweredCount: number;
  filters: { status: string; q: string };
}

const TABS = [
  { key: "UNANSWERED", label: "Sin responder" },
  { key: "ANSWERED", label: "Respondidas" },
  { key: "ALL", label: "Todas" },
];

export function PreguntasClient({ items, page, totalPages, total, unansweredCount, filters }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(filters.q);
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState<string | null>(null);

  function pushParams(mut: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mut(params);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setStatus(status: string) {
    pushParams((p) => (status === "UNANSWERED" ? p.delete("status") : p.set("status", status)));
  }

  function applySearch() {
    pushParams((p) => (query.trim() ? p.set("q", query.trim()) : p.delete("q")));
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/mercadolibre/questions/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo sincronizar");
        return;
      }
      toast.success(body.message ?? "Preguntas sincronizadas");
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnswer(id: string) {
    const text = (drafts[id] ?? "").trim();
    if (!text) return;
    setAnswering(id);
    try {
      const res = await fetch(`/api/integrations/mercadolibre/questions/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo responder");
        return;
      }
      toast.success("Respuesta enviada");
      setDrafts((d) => ({ ...d, [id]: "" }));
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAnswering(null);
    }
  }

  const activeStatus = filters.status || "UNANSWERED";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Preguntas MercadoLibre</h1>
          <p className="text-sm text-text-muted">
            {total} resultado{total !== 1 ? "s" : ""}
            {unansweredCount > 0 && ` · ${unansweredCount} sin responder`}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
          {syncing ? "Sincronizando..." : "Traer de ML"}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                activeStatus === t.key ? "bg-dark font-bold text-dark-fg" : "text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="Buscar en preguntas…"
            className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none sm:w-64"
          />
          <button onClick={applySearch} className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90">
            Buscar
          </button>
        </div>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border p-10 text-center text-sm text-text-muted">
          No hay preguntas. Tocá “Traer de ML” para sincronizar las recibidas.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((q) => (
            <div key={q.id} className="rounded-[20px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-text">{q.text}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {q.propertyAddress ? (
                      q.permalink ? (
                        <a href={q.permalink} target="_blank" rel="noreferrer" className="underline">
                          {q.propertyAddress}
                        </a>
                      ) : (
                        q.propertyAddress
                      )
                    ) : (
                      <span>Aviso {q.itemId}</span>
                    )}
                    {q.askedAt && <span> · {formatDateTime(q.askedAt)}</span>}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    q.status === "ANSWERED"
                      ? "bg-sage-chip text-olive-light"
                      : "bg-sand-chip text-warning"
                  }`}
                >
                  {q.status === "ANSWERED" ? "Respondida" : "Sin responder"}
                </span>
              </div>

              {q.status === "ANSWERED" ? (
                <div className="mt-3 rounded-[14px] border border-border bg-bg px-3 py-2">
                  <p className="text-[11px] font-medium text-text-muted">Respuesta</p>
                  <p className="text-sm text-text">{q.answerText ?? "—"}</p>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    placeholder="Escribí tu respuesta…"
                    className="min-h-[64px] w-full resize-y rounded-[14px] border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleAnswer(q.id)}
                      disabled={answering === q.id || !(drafts[q.id] ?? "").trim()}
                      className="inline-flex h-10 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 active:opacity-90 disabled:opacity-50"
                    >
                      {answering === q.id ? "Enviando…" : "Responder"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={20} />
    </div>
  );
}
