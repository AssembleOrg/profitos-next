"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "../../_components/spinner";
import { Sheet } from "../../_components/sheet";
import type { SerializedCard, SerializedItem } from "./types";

interface ItemsEditorSheetProps {
  card: SerializedCard;
  open: boolean;
  onClose: () => void;
  onChanged: (next: SerializedCard) => void;
}

export function ItemsEditorSheet({ card, open, onClose, onChanged }: Readonly<ItemsEditorSheetProps>) {
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Editar ítems"
      description={card.title}
      maxWidth="sm:max-w-md"
      footer={
        <div className="flex w-full items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-[13px] font-semibold text-text-faint hover:text-text"
          >
            Cerrar
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {card.items.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {card.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-[12px] bg-bg px-3 py-2 text-[13px]"
              >
                <span className="flex-1 truncate text-text-muted">{item.text}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className="shrink-0 text-text-faint transition-colors hover:text-terra"
                  aria-label={`Quitar ${item.text}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            autoFocus
            className="h-10 flex-1 rounded-full border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={submitting || !text.trim()}
            className="h-10 shrink-0 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Spinner size={12} /> : "Agregar"}
          </button>
        </div>
      </div>
    </Sheet>
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
