import { DateTime, fromISO, fromJSDate, now } from "@/lib/datetime";

export type CardStatus = "pending" | "in_progress" | "completed";
export type ItemStatus = "pending" | "done" | "failed";

export const CARD_STATUSES: readonly CardStatus[] = ["pending", "in_progress", "completed"] as const;
export const ITEM_STATUSES: readonly ItemStatus[] = ["pending", "done", "failed"] as const;

export function isCardStatus(value: unknown): value is CardStatus {
  return value === "pending" || value === "in_progress" || value === "completed";
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return value === "pending" || value === "done" || value === "failed";
}

interface DateLike {
  startDate: Date | string;
  endDate: Date | string;
  statusOverride?: string | null;
}

function toDateTime(value: Date | string) {
  return typeof value === "string" ? fromISO(value) : fromJSDate(value);
}

/**
 * Effective status for a card. If `statusOverride` is set, it wins.
 * Otherwise it's derived from the current date vs start/end.
 */
export function getCardStatus(card: DateLike): CardStatus {
  if (card.statusOverride && isCardStatus(card.statusOverride)) {
    return card.statusOverride;
  }
  const today = now().startOf("day");
  const start = toDateTime(card.startDate).startOf("day");
  const end = toDateTime(card.endDate).startOf("day");
  if (today < start) return "pending";
  if (today > end) return "completed";
  return "in_progress";
}

interface ItemLike {
  status: string;
}

interface ProgressInput {
  items: ItemLike[];
}

export interface ObjectiveProgress {
  total: number;
  done: number;
  failed: number;
  pendingCount: number;
  /** % of done over total (0..100, integer). */
  percent: number;
}

export function getCardProgress(card: ProgressInput): ObjectiveProgress {
  const total = card.items.length;
  const done = card.items.filter((i) => i.status === "done").length;
  const failed = card.items.filter((i) => i.status === "failed").length;
  const pendingCount = total - done - failed;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, failed, pendingCount, percent };
}

/**
 * Days remaining (>=0) until the card's endDate. Returns 0 if already past or completed.
 */
export function daysRemaining(card: { endDate: Date | string }): number {
  const today = now().startOf("day");
  const end = toDateTime(card.endDate).startOf("day");
  const diff = end.diff(today, "days").days;
  return Math.max(0, Math.round(diff));
}

/**
 * Default range used by the create form: first day → last day of the current month.
 */
export function defaultPeriod(): { startDate: string; endDate: string } {
  const start = now().startOf("month");
  const end = now().endOf("month");
  return {
    startDate: start.toISODate() ?? "",
    endDate: end.toISODate() ?? "",
  };
}

export interface AggregateKPIs {
  totalCards: number;
  pending: number;
  inProgress: number;
  completed: number;
  /** % of completed items / total items across all cards (integer). */
  globalPercent: number;
}

export function getAggregateKPIs(
  cards: Array<DateLike & ProgressInput>,
): AggregateKPIs {
  let totalItems = 0;
  let doneItems = 0;
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  for (const card of cards) {
    const status = getCardStatus(card);
    if (status === "pending") pending++;
    else if (status === "in_progress") inProgress++;
    else completed++;
    const progress = getCardProgress(card);
    totalItems += progress.total;
    doneItems += progress.done;
  }
  return {
    totalCards: cards.length,
    pending,
    inProgress,
    completed,
    globalPercent: totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100),
  };
}

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Finalizado",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Sin evaluar",
  done: "Cumplido",
  failed: "No cumplido",
};

/** Click cycles status: pending → done → failed → pending. */
export function nextItemStatus(current: ItemStatus): ItemStatus {
  if (current === "pending") return "done";
  if (current === "done") return "failed";
  return "pending";
}

export type { DateTime };
