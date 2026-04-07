"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
}

export function Pagination({ page, totalPages, total }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

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

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-text-muted">
        {total} resultado{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-bg px-2 text-text-muted transition-all hover:border-secondary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {pages.map((item, index) =>
          item === "..." ? (
            <span key={`dots-${index}`} className="px-1 text-xs text-text-muted">…</span>
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
