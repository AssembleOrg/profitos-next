"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Spinner } from "../../_components/spinner";
import {
  CARD_STATUS_LABEL,
  daysRemaining,
  getCardProgress,
  getCardStatus,
  nextItemStatus,
  type CardStatus,
  type ItemStatus,
} from "@/lib/objectives";
import { formatDate, formatRelative, fromISO } from "@/lib/datetime";
import { ItemsEditorSheet } from "./items-editor";
import type { SerializedCard, SerializedItem } from "./types";

interface ObjetivoCardProps {
  card: SerializedCard;
  canEdit: boolean;
  currentUserId: string;
  onChanged: (next: SerializedCard) => void;
  onItemChanged: (cardId: string, updatedItem: SerializedItem) => void;
  onDeleted: (id: string) => void;
  onEdit: (card: SerializedCard) => void;
}

const STATUS_STYLE: Record<CardStatus, { dot: string; chip: string; ring: string }> = {
  pending: {
    dot: "bg-text-faint",
    chip: "bg-bg text-text-faint",
    ring: "",
  },
  in_progress: {
    dot: "bg-olive-light",
    chip: "bg-sage-chip text-olive-light",
    ring: "",
  },
  completed: {
    dot: "bg-olive-light",
    chip: "bg-sage-chip text-olive-light",
    ring: "",
  },
};

const ITEM_STATUS_STYLE: Record<ItemStatus, { box: string; label: string; line: string }> = {
  pending: {
    box: "border-border-strong bg-surface",
    label: "text-text",
    line: "",
  },
  done: {
    box: "border-olive-light bg-olive-light text-white",
    label: "text-text-muted",
    line: "line-through decoration-1",
  },
  failed: {
    box: "border-terra bg-terra text-white",
    label: "text-text-muted",
    line: "line-through decoration-1",
  },
};

export function ObjetivoCard({
  card,
  canEdit,
  currentUserId,
  onChanged,
  onItemChanged,
  onDeleted,
  onEdit,
}: Readonly<ObjetivoCardProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const status = getCardStatus(card);
  const progress = getCardProgress(card);
  const statusStyle = STATUS_STYLE[status];
  // Derivado del progreso (no de fechas): cumplido/finalizado visual, sin tocar backend.
  const isFinished = progress.total > 0 && progress.pendingCount === 0;
  const isAchieved = progress.total > 0 && progress.done === progress.total;
  // Banda de estado (tope de la card). Respeta el override manual.
  const band =
    !card.statusOverride && isAchieved
      ? { label: "Cumplido", cls: "bg-sage-chip text-olive-light", dot: "bg-olive-light", check: true }
      : !card.statusOverride && isFinished
        ? { label: "Finalizado", cls: "bg-bg text-text-muted", dot: "bg-text-faint", check: false }
        : { label: CARD_STATUS_LABEL[status], cls: statusStyle.chip, dot: statusStyle.dot, check: false };
  const isUserAssignee = card.assignedToUser.id === currentUserId;
  const canTickItems = canEdit || isUserAssignee;
  const remaining = daysRemaining(card);

  const assigneeName =
    card.assignedToUser.fullName?.trim() || card.assignedToUser.email.split("@")[0];
  const initials = (card.assignedToUser.fullName ?? card.assignedToUser.email)
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  async function toggleItemStatus(item: SerializedItem) {
    if (!canTickItems || loadingItems.has(item.id)) return;
    const next = nextItemStatus(item.status);

    setLoadingItems((prev) => new Set(prev).add(item.id));
    onItemChanged(card.id, {
      ...item,
      status: next,
      evaluatedAt: new Date().toISOString(),
      evaluatedByUser: { id: currentUserId, email: "", fullName: "Tú" },
    });

    try {
      const res = await fetch(`/api/objetivos/${card.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const updated = serializeItem(body.data);
      onItemChanged(card.id, updated);
      // Celebración solo al CRUZAR a 100% done (antes no lo estaba, ahora sí).
      const wasAchieved = progress.total > 0 && progress.done === progress.total;
      const nextItems = card.items.map((i) => (i.id === updated.id ? updated : i));
      const nowAchieved = nextItems.length > 0 && nextItems.every((i) => i.status === "done");
      if (!wasAchieved && nowAchieved) toast.success("🎉 ¡Objetivo cumplido!");
    } catch (error) {
      onItemChanged(card.id, item);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    } finally {
      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function handleDelete() {
    if (!canEdit) return;
    if (!confirm(`¿Eliminar el objetivo "${card.title}"? Esta acción no se puede deshacer.`)) return;
    setMenuOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/objetivos/${card.id}`, { method: "DELETE" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? "Error al eliminar");
        toast.success("Objetivo eliminado");
        onDeleted(card.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
      }
    });
  }

  async function changeOverride(value: CardStatus | null) {
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/objetivos/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOverride: value }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onChanged(serializeCard(body.data));
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado");
    }
  }

  return (
    <>
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex h-full flex-col overflow-hidden rounded-[20px] border bg-surface transition-shadow hover:shadow-sm ${isAchieved ? "border-olive-light/50 ring-1 ring-olive-light/30" : "border-border"}`}
    >
      {/* Banda de estado (tope full-width) */}
      <div className={`flex items-center gap-1.5 px-5 py-1.5 text-[11px] font-bold ${band.cls}`}>
        {band.check ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className={`h-1.5 w-1.5 rounded-full ${band.dot}`} />
        )}
        {band.label}
      </div>

      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand-chip font-display text-[12px] font-bold uppercase text-text-muted">
            {card.assignedToUser.avatarUrl ? (
              <img
                src={card.assignedToUser.avatarUrl}
                alt={assigneeName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{initials || "·"}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold text-text">{assigneeName}</p>
            <p className="truncate text-[11px] text-text-faint">{card.assignedToUser.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menú"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-bg hover:text-text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar menú"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(card);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
                      >
                        Editar objetivo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setItemsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
                      >
                        Editar ítems
                      </button>
                      <div className="my-1 border-t border-border" />
                      <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                        Forzar estado
                      </p>
                      {(["pending", "in_progress", "completed"] as CardStatus[]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => changeOverride(value)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                            card.statusOverride === value
                              ? "bg-sage-chip font-bold text-olive-light"
                              : "text-text-muted hover:bg-bg hover:text-text"
                          }`}
                        >
                          <span>{CARD_STATUS_LABEL[value]}</span>
                          {card.statusOverride === value && (
                            <span className="text-[10px] uppercase tracking-wider">activo</span>
                          )}
                        </button>
                      ))}
                      {card.statusOverride && (
                        <button
                          type="button"
                          onClick={() => changeOverride(null)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:bg-bg hover:text-text"
                        >
                          Quitar override (auto)
                        </button>
                      )}
                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-terra transition-colors hover:bg-clay-chip disabled:opacity-50"
                      >
                        {pending ? <Spinner variant="red" size={12} /> : "Eliminar"}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold leading-tight text-text">{card.title}</h3>
          {card.description && (
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{card.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatDate(card.startDate)} → {formatDate(card.endDate)}
          </span>
          {status === "in_progress" && remaining > 0 && (
            <span className="text-text-muted">{remaining}d restantes</span>
          )}
          {card.statusOverride && (
            <span className="rounded-full bg-sand-chip px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">
              manual
            </span>
          )}
        </div>

        {card.items.length === 0 ? (
          <p className="rounded-[10px] bg-bg px-3 py-3 text-xs text-text-faint">
            Sin ítems aún.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {card.items.map((item) => {
              const itemStyle = ITEM_STATUS_STYLE[item.status];
              const evaluatedRel =
                item.evaluatedAt && item.status !== "pending"
                  ? formatRelative(item.evaluatedAt)
                  : null;
              const evaluatorName =
                item.evaluatedByUser?.fullName?.trim() ??
                item.evaluatedByUser?.email?.split("@")[0] ??
                null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleItemStatus(item)}
                    disabled={!canTickItems || loadingItems.has(item.id)}
                    title={
                      evaluatedRel
                        ? `${evaluatorName ? `Marcado por ${evaluatorName} · ` : ""}${evaluatedRel}`
                        : canTickItems
                          ? "Click para marcar"
                          : undefined
                    }
                    className={`flex w-full items-start gap-2.5 rounded-[10px] bg-bg px-2.5 py-2 text-left text-sm transition-colors ${
                      canTickItems ? "hover:bg-sand-chip/60" : "cursor-default"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${itemStyle.box}`}
                    >
                      {item.status === "done" && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {item.status === "failed" && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </span>
                    <span className={`flex-1 leading-snug ${itemStyle.label} ${itemStyle.line}`}>
                      {item.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-t border-border px-5 py-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className={`inline-flex items-center gap-1 font-semibold ${isAchieved ? "text-olive-light" : "text-text-muted"}`}>
            {isAchieved && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {progress.done}/{progress.total} cumplidos
            {progress.failed > 0 && (
              <span className="ml-1 text-terra">· {progress.failed} no</span>
            )}
          </span>
          <span className={`font-display font-bold ${isAchieved ? "text-olive-light" : "text-accent"}`}>{progress.percent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <motion.div
            initial={false}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${progress.percent === 100 ? "bg-olive-light" : "bg-accent"}`}
          />
        </div>
      </footer>
    </motion.article>
    {canEdit && (
      <ItemsEditorSheet
        card={card}
        open={itemsOpen}
        onClose={() => setItemsOpen(false)}
        onChanged={onChanged}
      />
    )}
    </>
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

function serializeCard(raw: unknown): SerializedCard {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    startDate: typeof r.startDate === "string" ? r.startDate.slice(0, 10) : new Date(r.startDate as string).toISOString().slice(0, 10),
    endDate: typeof r.endDate === "string" ? r.endDate.slice(0, 10) : new Date(r.endDate as string).toISOString().slice(0, 10),
    statusOverride: (r.statusOverride as SerializedCard["statusOverride"]) ?? null,
    assignedToUser: r.assignedToUser as SerializedUser,
    createdByUser: r.createdByUser as SerializedUser,
    items: ((r.items as unknown[]) ?? []).map(serializeItem),
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

type SerializedUser = SerializedCard["assignedToUser"];
