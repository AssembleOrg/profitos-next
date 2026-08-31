"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useId, type TransitionStartFunction } from "react";
import { SelectField } from "@/components/ui/select-field";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  limitOptions?: number[];
  /** Si el padre lo pasa, la navegación se envuelve en su transition (loading UX). */
  startTransition?: TransitionStartFunction;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  limitOptions = [10, 20, 50, 100],
  startTransition,
}: Readonly<PaginationProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const limitSelectId = useId();
  const navigate = (url: string) =>
    startTransition ? startTransition(() => router.push(url)) : router.push(url);

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
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  function updateLimit(nextLimit: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(nextLimit));
    params.delete("page");
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[12.5px] text-text-faint">
        {total} resultado{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2 sm:order-last">
        <label htmlFor={limitSelectId} className="text-[12.5px] text-text-faint">
          Por página
        </label>
        <SelectField
          id={limitSelectId}
          value={limit}
          onChange={(event) => updateLimit(Number(event.target.value))}
          className="h-9 rounded-full pl-3 pr-8 text-[12px]"
          wrapperClassName="w-20"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      </div>
      {/* Mobile: solo anterior / siguiente */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Ant.
        </button>
        <span className="flex-1 text-center text-[12.5px] text-text-faint">
          Pág {page} de {totalPages}
        </span>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {pages.map((item) =>
          item === "..." ? (
            <span key={`dots-${++dotsCount}`} className="px-1 text-xs text-text-faint">…</span>
          ) : (
            <button
              key={item}
              onClick={() => goTo(item)}
              className={`h-9 w-9 rounded-full text-xs transition-colors ${
                item === page
                  ? "bg-dark font-bold text-dark-fg"
                  : "font-semibold text-text-muted hover:bg-bg hover:text-text"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
