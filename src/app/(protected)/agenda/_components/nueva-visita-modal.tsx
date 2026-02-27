"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";

interface NuevaVisitaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const VISIT_TYPES = [
  { value: "visita", label: "Visita" },
  { value: "firma", label: "Firma" },
  { value: "tasacion", label: "Tasación" },
  { value: "otro", label: "Otro" },
];

export function NuevaVisitaModal({
  open,
  onClose,
  onCreated,
}: NuevaVisitaModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<SearchableSelectOption | null>(null);
  const [client, setClient] = useState<SearchableSelectOption | null>(null);

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

  /* ---- Submit ---- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      title: form.get("title") as string,
      date: form.get("date") as string,
      startTime: form.get("startTime") as string,
      endTime: form.get("endTime") as string,
      type: form.get("type") as string,
      propertyId: property?.id ?? undefined,
      clientId: client?.id ?? undefined,
      description: (form.get("description") as string) || undefined,
    };

    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Error al crear la visita");
        return;
      }

      setProperty(null);
      setClient(null);
      onCreated();
      onClose();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
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
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-medium text-text">Nueva visita</h2>
              <button
                onClick={handleClose}
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
                  placeholder="Ej: Visita depto 3amb - Palermo"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                />
              </div>

              {/* Date + Times */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Fecha *
                  </label>
                  <input
                    name="date"
                    type="date"
                    required
                    lang="es"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Inicio *
                  </label>
                  <input
                    name="startTime"
                    type="time"
                    required
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Fin *
                  </label>
                  <input
                    name="endTime"
                    type="time"
                    required
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Tipo
                </label>
                <select
                  name="type"
                  defaultValue="visita"
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
              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
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
                  ) : (
                    "Guardar visita"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
