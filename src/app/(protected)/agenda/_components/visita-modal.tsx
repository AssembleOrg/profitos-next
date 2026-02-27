"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";
import { TimePicker } from "./time-picker";
import { formatDate, parseVisualDate } from "@/lib/datetime";
import type { CalendarEvent } from "./calendar";

interface VisitaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** If provided, modal opens in edit mode with prefilled data */
  editEvent?: CalendarEvent | null;
}

const VISIT_TYPES = [
  { value: "visita", label: "Visita" },
  { value: "firma", label: "Firma" },
  { value: "tasacion", label: "Tasación" },
  { value: "otro", label: "Otro" },
];

export function VisitaModal({
  open,
  onClose,
  onSaved,
  editEvent,
}: VisitaModalProps) {
  const isEdit = !!editEvent;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<SearchableSelectOption | null>(null);
  const [client, setClient] = useState<SearchableSelectOption | null>(null);

  // Pre-fill property/client when editing
  useEffect(() => {
    if (editEvent && open) {
      setProperty(
        editEvent.propertyId
          ? { id: editEvent.propertyId, label: editEvent.property ?? "Propiedad" }
          : null
      );
      setClient(
        editEvent.clientId
          ? { id: editEvent.clientId, label: editEvent.client ?? "Cliente" }
          : null
      );
      setError(null);
    }
  }, [editEvent, open]);

  /* ---- Search handlers ---- */
  const searchProperties = useCallback(
    async (q: string): Promise<SearchableSelectOption[]> => {
      const res = await fetch(`/api/propiedades?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) return [];
      return (json.data ?? []).map(
        (p: { id: string; address: string; zone?: string; city?: string }) => ({
          id: p.id,
          label: p.address,
          sublabel: [p.zone, p.city].filter(Boolean).join(", ") || undefined,
        })
      );
    },
    []
  );

  const searchClients = useCallback(
    async (q: string): Promise<SearchableSelectOption[]> => {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) return [];
      return (json.data ?? []).map(
        (c: { id: string; name: string; phone?: string; email?: string }) => ({
          id: c.id,
          label: c.name,
          sublabel: [c.phone, c.email].filter(Boolean).join(" · ") || undefined,
        })
      );
    },
    []
  );

  /* ---- Quick-create handlers ---- */
  const createProperty = useCallback(
    async (address: string): Promise<SearchableSelectOption | null> => {
      const res = await fetch("/api/propiedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      if (!res.ok) return null;
      return { id: json.data.id, label: json.data.address };
    },
    []
  );

  const createClient = useCallback(
    async (name: string): Promise<SearchableSelectOption | null> => {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) return null;
      return { id: json.data.id, label: json.data.name };
    },
    []
  );

  /* ---- Submit (create or update) ---- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const dateRaw = (form.get("date") as string)?.trim() ?? "";
    const dateIso = parseVisualDate(dateRaw);
    const validIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dateIso);
    if (!dateRaw || !validIsoDate) {
      setError("Fecha inválida. Use formato DD/MM/AAAA (ej: 27/02/2026).");
      setLoading(false);
      return;
    }
    const body = {
      title: form.get("title") as string,
      date: dateIso,
      startTime: form.get("startTime") as string,
      endTime: form.get("endTime") as string,
      type: form.get("type") as string,
      propertyId: property?.id ?? null,
      clientId: client?.id ?? null,
      description: (form.get("description") as string) || undefined,
    };

    try {
      const url = isEdit ? `/api/visitas/${editEvent.id}` : "/api/visitas";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? `Error al ${isEdit ? "actualizar" : "crear"} la visita`);
        return;
      }

      toast.success(isEdit ? "Visita actualizada" : "Visita creada");
      resetAndClose();
      onSaved();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  /* ---- Delete ---- */
  async function handleDelete() {
    if (!editEvent) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/visitas/${editEvent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Error al eliminar la visita");
        return;
      }

      toast.success("Visita eliminada");
      resetAndClose();
      onSaved();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(false);
    }
  }

  function resetAndClose() {
    setProperty(null);
    setClient(null);
    setError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-medium text-text">
                {isEdit ? "Editar visita" : "Nueva visita"}
              </h2>
              <button
                onClick={resetAndClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Título *
                </label>
                <input
                  name="title"
                  required
                  defaultValue={editEvent?.title ?? ""}
                  placeholder="Ej: Visita depto 3amb - Palermo"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                />
              </div>

              {/* Date + Times (fecha en formato visual DD/MM/AAAA) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Fecha *
                  </label>
                  <input
                    name="date"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="DD/MM/AAAA"
                    defaultValue={
                      editEvent?.date
                        ? formatDate(editEvent.date)
                        : formatDate(new Date())
                    }
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                  />
                </div>
                <TimePicker
                  name="startTime"
                  label="Inicio"
                  required
                  defaultValue={editEvent?.startTime ?? "09:00"}
                />
                <TimePicker
                  name="endTime"
                  label="Fin"
                  required
                  defaultValue={editEvent?.endTime ?? "10:00"}
                />
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Tipo
                </label>
                <select
                  name="type"
                  defaultValue={editEvent?.type ?? "visita"}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                >
                  {VISIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property selector */}
              <SearchableSelect
                label="Propiedad"
                placeholder="Seleccionar propiedad..."
                searchPlaceholder="Buscar por dirección, zona..."
                value={property}
                onChange={setProperty}
                onSearch={searchProperties}
                onCreate={createProperty}
                createLabel="Crear propiedad"
              />

              {/* Client selector */}
              <SearchableSelect
                label="Cliente"
                placeholder="Seleccionar cliente..."
                searchPlaceholder="Buscar por nombre, teléfono, email..."
                value={client}
                onChange={setClient}
                onSearch={searchClients}
                onCreate={createClient}
                createLabel="Crear cliente"
              />

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Notas
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editEvent?.description ?? ""}
                  placeholder="Notas adicionales..."
                  className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="mt-2 flex items-center justify-between">
                {/* Delete button (only in edit mode) */}
                {isEdit ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    {deleting ? "Eliminando..." : "Eliminar"}
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                        Guardando...
                      </>
                    ) : isEdit ? (
                      "Guardar cambios"
                    ) : (
                      "Guardar visita"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
