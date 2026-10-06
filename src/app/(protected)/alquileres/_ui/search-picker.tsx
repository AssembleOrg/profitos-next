"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "./icons";

export interface PickerItem {
  id: string;
  label: string;
  sub?: string | null;
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Combobox liviano: buscás, elegís. La lista se abre debajo del campo (sin
 * portal) para que funcione igual dentro de páginas y en mobile.
 */
export function SearchPicker({
  items,
  value,
  onChange,
  placeholder,
  emptyText = "Sin resultados",
  footer,
  ariaLabel,
}: {
  items: PickerItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  emptyText?: string;
  footer?: React.ReactNode;
  ariaLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = items.find((i) => i.id === value) ?? null;

  const results = useMemo(() => {
    const q = norm(query.trim());
    const list = q ? items.filter((i) => norm(`${i.label} ${i.sub ?? ""}`).includes(q)) : items;
    return list.slice(0, 40);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (selected && !open) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-[14px] border border-border bg-surface py-1.5 pl-3.5 pr-1.5">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{selected.label}</p>
          {selected.sub && <p className="truncate text-[11.5px] text-text-faint">{selected.sub}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
            setOpen(true);
          }}
          aria-label={`Cambiar ${ariaLabel.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-faint hover:bg-bg hover:text-text"
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-border bg-surface px-3.5 focus-within:border-accent">
        <IconSearch size={16} className="shrink-0 text-text-faint" />
        <input
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              onChange(results[active].id);
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-faint"
        />
      </div>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_18px_40px_-20px_rgba(27,25,22,0.35)]">
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3.5 py-3 text-[12.5px] text-text-faint">{emptyText}</li>}
            {results.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3.5 py-2 ${i === active ? "bg-bg" : ""}`}
              >
                <p className="truncate text-[13px] font-semibold text-text">{item.label}</p>
                {item.sub && <p className="truncate text-[11.5px] text-text-faint">{item.sub}</p>}
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-border px-2 py-1.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}
