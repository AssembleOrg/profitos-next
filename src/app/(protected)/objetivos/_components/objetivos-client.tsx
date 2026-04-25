"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAggregateKPIs } from "@/lib/objectives";
import { formatDate } from "@/lib/datetime";
import { Pagination } from "../../_components/pagination";
import { ObjetivoCard } from "./objetivo-card";
import { CreateObjetivoModal } from "./create-modal";
import { FiltersBar } from "./filters-bar";
import { KPIStrip } from "./kpi-strip";
import type { SerializedCard, SerializedUser } from "./types";
import { ItemsEditorPopover } from "./items-editor";

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
          <h1 className="font-display text-2xl text-text md:text-3xl">
            {isAdmin ? "Objetivos" : "Mis objetivos"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {isAdmin
              ? "Asigná y revisá los objetivos de cada empleado."
              : "Marcá tus objetivos a medida que los vas cumpliendo."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-all hover:bg-olive-vivid sm:self-auto"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            {cards.map((card) => (
              <div key={card.id} className="flex flex-col gap-2">
                <ObjetivoCard
                  card={card}
                  canEdit={isAdmin}
                  currentUserId={currentUserId}
                  onChanged={handleCardChanged}
                  onDeleted={handleCardDeleted}
                  onEdit={handleEdit}
                />
                {isAdmin && (
                  <ItemsEditorPopover card={card} onChanged={handleCardChanged} />
                )}
              </div>
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border-olive bg-olive-subtle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-olive-light">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <div>
        <p className="font-display text-lg text-text">
          {hasPeriod ? "Sin objetivos en este período" : "Todavía no hay objetivos"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          {isAdmin
            ? "Creá la primera card y asignala a uno o varios empleados."
            : "Tu admin todavía no te asignó ningún objetivo."}
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid"
        >
          Crear el primero
        </button>
      )}
    </div>
  );
}
