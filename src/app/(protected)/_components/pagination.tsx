"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useId } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  limitOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  limitOptions = [10, 20, 50, 100],
}: Readonly<PaginationProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const limitSelectId = useId();

  if (totalPages < 2) return null;

  const pageSizeOptions = Array.from(new Set([...limitOptions, limit]))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  let dotsCount = 0;

  const pages: Array<number | "..."> = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, "...", totalPages];
    if (page >= totalPages - 2) return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  })();

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function updateLimit(nextLimit: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(nextLimit));
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-text-muted">
        {total} resultado{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2 sm:order-last">
        <label htmlFor={limitSelectId} className="text-xs text-text-muted">
          Por página
        </label>
        <select
          id={limitSelectId}
          value={limit}
          onChange={(event) => updateLimit(Number(event.target.value))}
          className="h-9 rounded-xl border border-border bg-bg px-2.5 text-xs text-text focus:border-secondary focus:outline-none scheme-dark"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {/* Mobile: solo anterior / siguiente */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-all hover:border-secondary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Ant.
        </button>
        <span className="flex-1 text-center text-xs text-text-muted">
          Pág {page} de {totalPages}
        </span>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-all hover:border-secondary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sig.
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Desktop: botones numéricos */}
      <div className="hidden sm:flex items-center gap-1.5">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-bg px-2 text-text-muted transition-all hover:border-secondary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {pages.map((item) =>
          item === "..." ? (
            <span key={`dots-${++dotsCount}`} className="px-1 text-xs text-text-muted">…</span>
          ) : (
            <button
              key={item}
              onClick={() => goTo(item)}
              className={`h-9 min-w-9 rounded-xl border px-2 text-xs font-semibold transition-all ${
                item === page
                  ? "border-secondary/50 bg-secondary/20 text-secondary shadow-[0_0_0_1px_rgba(76,191,123,0.15)]"
                  : "border-border bg-bg text-text-muted hover:border-secondary/40 hover:text-text"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-bg px-2 text-text-muted transition-all hover:border-secondary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
