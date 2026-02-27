"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  value: SearchableSelectOption | null;
  onChange: (option: SearchableSelectOption | null) => void;
  onSearch: (query: string) => Promise<SearchableSelectOption[]>;
  onCreate?: (name: string) => Promise<SearchableSelectOption | null>;
  createLabel?: string; // e.g. "Crear cliente"
}

export function SearchableSelect({
  label,
  placeholder,
  searchPlaceholder,
  value,
  onChange,
  onSearch,
  onCreate,
  createLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Search with debounce
  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const results = await onSearch(q);
        setOptions(results);
        setLoading(false);
      }, 250);
    },
    [onSearch]
  );

  // Initial load when opening
  useEffect(() => {
    if (open) {
      doSearch(query);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Search on query change
  useEffect(() => {
    if (open) doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(option: SearchableSelectOption) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  }

  async function handleCreate() {
    if (!onCreate || !query.trim()) return;
    setCreating(true);
    const created = await onCreate(query.trim());
    setCreating(false);
    if (created) {
      handleSelect(created);
    }
  }

  const noResults = !loading && options.length === 0 && query.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {label}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-left text-sm transition-colors focus:border-secondary focus:outline-none ${
          value ? "text-text" : "text-text-muted/50"
        }`}
      >
        <span className="truncate">
          {value ? value.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={handleClear}
              className="flex h-4 w-4 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          {/* Search input */}
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-text-muted">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? "Buscar..."}
                className="w-full bg-transparent text-sm text-text placeholder:text-text-muted/50 focus:outline-none"
              />
              {loading && (
                <span className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-text-muted/20 border-t-text-muted" />
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg ${
                  value?.id === opt.id ? "bg-secondary/10" : ""
                }`}
              >
                <span className="text-sm text-text">{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-[11px] text-text-muted">{opt.sublabel}</span>
                )}
              </button>
            ))}

            {noResults && !onCreate && (
              <p className="px-3 py-4 text-center text-xs text-text-muted">
                Sin resultados
              </p>
            )}

            {/* Create new option */}
            {onCreate && query.trim() && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-50"
              >
                {creating ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
                {createLabel ?? "Crear"} &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
