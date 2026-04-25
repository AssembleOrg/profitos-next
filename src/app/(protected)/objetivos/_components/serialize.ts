import type { SerializedCard, SerializedItem } from "./types";

interface RawItem {
  id: string;
  text: string;
  status: string;
  position: number;
  evaluatedAt: Date | null;
  evaluatedByUser: { id: string; email: string; fullName: string | null } | null;
}

interface RawCard {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  statusOverride: string | null;
  assignedToUser: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
  createdByUser: { id: string; email: string; fullName: string | null };
  items: RawItem[];
  createdAt: Date;
  updatedAt: Date;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function serializeItem(item: RawItem): SerializedItem {
  return {
    id: item.id,
    text: item.text,
    status: item.status as SerializedItem["status"],
    position: item.position,
    evaluatedAt: item.evaluatedAt?.toISOString() ?? null,
    evaluatedByUser: item.evaluatedByUser,
  };
}

export function serializeCard(card: RawCard): SerializedCard {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    startDate: isoDateOnly(card.startDate),
    endDate: isoDateOnly(card.endDate),
    statusOverride: card.statusOverride as SerializedCard["statusOverride"],
    assignedToUser: card.assignedToUser,
    createdByUser: card.createdByUser,
    items: card.items.map(serializeItem),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
