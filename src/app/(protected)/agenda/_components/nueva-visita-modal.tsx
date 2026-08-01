"use client";

import { useState, useCallback } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Spinner } from "../../_components/spinner";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";
import { Sheet } from "../../_components/sheet";
import { MediaUploader, type NoteAttachment } from "@/components/notes/media-uploader";

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
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);

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
      attachments,
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
      setAttachments([]);
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
    <Sheet
      open={open}
      onClose={handleClose}
      title="Nueva visita"
      maxWidth="sm:max-w-lg"
      footer={
        <div className="ml-auto flex gap-3">
          <button type="button" onClick={handleClose} className="px-2 text-[13px] font-semibold text-text-faint active:text-text">Cancelar</button>
          <button type="submit" form="nueva-visita-form" disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? <Spinner /> : "Guardar visita"}
          </button>
        </div>
      }
    >
            {/* Form */}
            <form id="nueva-visita-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                  Título *
                </label>
                <input
                  name="title"
                  required
                  placeholder="Ej: Visita depto 3amb - Palermo"
                  className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                />
              </div>

              {/* Date + Times */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                    Fecha *
                  </label>
                  <DatePicker name="date" required className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none" />
                </div>
                <TimePicker name="startTime" label="Inicio" required defaultValue="09:00" />
                <TimePicker name="endTime" label="Fin" required defaultValue="10:00" />
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                  Tipo
                </label>
                <select
                  name="type"
                  defaultValue="visita"
                  className="h-11 w-full appearance-none rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none [color-scheme:light]"
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
                <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                  Notas
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Notas adicionales..."
                  className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                />
                <div className="mt-2">
                  <MediaUploader attachments={attachments} onChange={setAttachments} />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-[14px] bg-clay-chip px-3.5 py-2 text-sm font-semibold text-terra">
                  {error}
                </p>
              )}

            </form>
    </Sheet>
  );
}
