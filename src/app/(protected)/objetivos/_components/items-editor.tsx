"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { SerializedCard, SerializedItem } from "./types";

interface ItemsEditorPopoverProps {
  card: SerializedCard;
  onChanged: (next: SerializedCard) => void;
}

export function ItemsEditorPopover({ card, onChanged }: Readonly<ItemsEditorPopoverProps>) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addItem() {
    const value = text.trim();
    if (!value) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/objetivos/${card.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const newItem = serializeItem(body.data);
      onChanged({ ...card, items: [...card.items, newItem] });
      setText("");
      toast.success("Ítem agregado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(item: SerializedItem) {
    if (!confirm(`¿Quitar el ítem "${item.text}"?`)) return;
    try {
      const res = await fetch(`/api/objetivos/${card.id}/items/${item.id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onChanged({ ...card, items: card.items.filter((i) => i.id !== item.id) });
      toast.success("Ítem eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-text-muted transition-colors hover:text-text"
      >
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          Editar ítems
        </span>
        <span className="text-text-faint">{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
              {card.items.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {card.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md bg-bg/40 px-2 py-1 text-xs"
                    >
                      <span className="flex-1 truncate text-text-muted">{item.text}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="text-text-faint transition-colors hover:text-red-300"
                        aria-label={`Quitar ${item.text}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Nuevo ítem…"
                  className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={submitting || !text.trim()}
                  className="rounded-lg border border-olive-bright/30 bg-olive-mid px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function serializeItem(raw: unknown): SerializedItem {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    text: r.text as string,
    status: r.status as SerializedItem["status"],
    position: r.position as number,
    evaluatedAt: r.evaluatedAt ? new Date(r.evaluatedAt as string).toISOString() : null,
    evaluatedByUser: r.evaluatedByUser as SerializedItem["evaluatedByUser"],
  };
}
