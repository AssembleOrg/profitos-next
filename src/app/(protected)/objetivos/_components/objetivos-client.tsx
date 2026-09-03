"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAggregateKPIs, getCardProgress } from "@/lib/objectives";
import { formatDate } from "@/lib/datetime";
import { Pagination } from "../../_components/pagination";
import { ObjetivoCard } from "./objetivo-card";
import { CreateObjetivoModal } from "./create-modal";
import { FiltersBar } from "./filters-bar";
import { KPIStrip } from "./kpi-strip";
import type { SerializedCard, SerializedItem, SerializedUser } from "./types";

interface ObjetivosClientProps {
  initialCards: SerializedCard[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  currentUserId: string;
  users: SerializedUser[];
  filters: {
    assignedToUserId: string;
    from: string;
    to: string;
  };
}

export function ObjetivosClient({
  initialCards,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  currentUserId,
  users,
  filters,
}: Readonly<ObjetivosClientProps>) {
  const [cards, setCards] = useState<SerializedCard[]>(initialCards);
  // Re-sincronizar cuando el server manda otra data (búsqueda / paginación):
  // useState() no reinicia solo al cambiar el prop.
  const [syncedInitial, setSyncedInitial] = useState(initialCards);
  if (syncedInitial !== initialCards) {
    setSyncedInitial(initialCards);
    setCards(initialCards);
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedCard | null>(null);

  const kpis = useMemo(() => getAggregateKPIs(cards), [cards]);
  const hasPeriod = Boolean(filters.from || filters.to);
  const periodLabel = hasPeriod
    ? `${filters.from ? formatDate(filters.from) : "—"} → ${filters.to ? formatDate(filters.to) : "—"}`
    : "Histórico completo";

  function handleCardChanged(next: SerializedCard) {
    setCards((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }

  function handleItemChanged(cardId: string, updatedItem: SerializedItem) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, items: c.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)) }
          : c,
      ),
    );
  }

  function handleCardDeleted(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCreated(created: SerializedCard[]) {
    setCards((prev) => [...created, ...prev]);
  }

  function handleEdit(card: SerializedCard) {
    setEditing(card);
    setModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">
            {isAdmin ? "Objetivos" : "Mis objetivos"}
          </h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            {isAdmin
              ? "Asigná y revisá los objetivos de cada empleado."
              : "Marcá tus objetivos a medida que los vas cumpliendo."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo objetivo
          </button>
        )}
      </header>

      <KPIStrip kpis={kpis} periodLabel={periodLabel} />

      <FiltersBar
        users={users}
        showUserFilter={isAdmin}
        selectedUserId={filters.assignedToUserId}
        from={filters.from}
        to={filters.to}
      />

      {cards.length === 0 ? (
        <EmptyState isAdmin={isAdmin} hasPeriod={hasPeriod} onCreate={openCreate} />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {cards
              .map((card, i) => ({ card, i, finished: (() => { const p = getCardProgress(card); return p.total > 0 && p.pendingCount === 0; })() }))
              .sort((a, b) => (a.finished === b.finished ? a.i - b.i : a.finished ? 1 : -1))
              .map(({ card }) => (
                <ObjetivoCard
                  key={card.id}
                  card={card}
                  canEdit={isAdmin}
                  currentUserId={currentUserId}
                  onChanged={handleCardChanged}
                  onItemChanged={handleItemChanged}
                  onDeleted={handleCardDeleted}
                  onEdit={handleEdit}
                />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {isAdmin && (
        <CreateObjetivoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          users={users}
          editing={editing}
          onCreated={handleCreated}
          onUpdated={handleCardChanged}
        />
      )}
    </div>
  );
}

interface EmptyStateProps {
  isAdmin: boolean;
  hasPeriod: boolean;
  onCreate: () => void;
}

function EmptyState({ isAdmin, hasPeriod, onCreate }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-bg px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-chip">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <div>
        <p className="font-display text-[15px] font-semibold text-text">
          {hasPeriod ? "Sin objetivos en este período" : "Todavía no hay objetivos"}
        </p>
        <p className="mt-1 max-w-sm text-[12.5px] text-text-faint">
          {isAdmin
            ? "Creá la primera card y asignala a uno o varios empleados."
            : "Tu admin todavía no te asignó ningún objetivo."}
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
        >
          Crear el primero
        </button>
      )}
    </div>
  );
}
