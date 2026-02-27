"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, type CalendarEvent } from "./calendar";
import { VisitaModal } from "./visita-modal";

interface AgendaClientProps {
  events: CalendarEvent[];
}

export function AgendaClient({ events }: AgendaClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const router = useRouter();

  function handleNew() {
    setEditEvent(null);
    setModalOpen(true);
  }

  function handleEventClick(event: CalendarEvent) {
    setEditEvent(event);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditEvent(null);
  }

  function handleSaved() {
    handleClose();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text">Agenda</h1>
          <p className="text-sm text-text-muted">
            Visitas, firmas y tasaciones programadas
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva visita
        </button>
      </div>

      {/* Calendar */}
      <Calendar events={events} onEventClick={handleEventClick} />

      {/* Modal (create & edit) */}
      <VisitaModal
        open={modalOpen}
        onClose={handleClose}
        onSaved={handleSaved}
        editEvent={editEvent}
      />
    </div>
  );
}
