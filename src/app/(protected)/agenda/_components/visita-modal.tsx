"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { Spinner } from "../../_components/spinner";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, parseVisualDate } from "@/lib/datetime";
import type { CalendarEvent } from "./calendar";
import { MediaUploader, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";

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
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const signedUrls = useNoteSignedUrls(attachments.map((a) => a.path));

  // Pre-fill property/client when editing
  useEffect(() => {
    if (open) {
      setProperty(
        editEvent?.propertyId
          ? { id: editEvent.propertyId, label: editEvent.property ?? "Propiedad" }
          : null
      );
      setClient(
        editEvent?.clientId
          ? { id: editEvent.clientId, label: editEvent.client ?? "Cliente" }
          : null
      );
      setAttachments(editEvent?.attachments ?? []);
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
      attachments,
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
    <Sheet
      open={open}
      onClose={resetAndClose}
      title={isEdit ? "Editar visita" : "Nueva visita"}
      maxWidth="sm:max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between">
          {isEdit ? (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="flex h-10 items-center gap-1.5 rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity active:opacity-80 disabled:opacity-50">
              {deleting ? <Spinner variant="red" size={14} /> : "Eliminar"}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button type="button" onClick={resetAndClose} className="px-2 text-[13px] font-semibold text-text-faint active:text-text">Cancelar</button>
            <button type="submit" form="visita-form" disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? <Spinner /> : isEdit ? "Guardar cambios" : "Guardar visita"}
            </button>
          </div>
        </div>
      }
    >
            {/* Form */}
            <form id="visita-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                  Título *
                </label>
                <input
                  name="title"
                  required
                  defaultValue={editEvent?.title ?? ""}
                  placeholder="Ej: Visita depto 3amb - Palermo"
                  className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                />
              </div>

              {/* Date + Times (fecha en formato visual DD/MM/AAAA) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                    Fecha *
                  </label>
                  <DatePicker
                    name="date"
                    required
                    defaultValue={parseVisualDate(formatDate(editEvent?.date ?? new Date()))}
                    className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
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
                <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
                  Tipo
                </label>
                <select
                  name="type"
                  defaultValue={editEvent?.type ?? "visita"}
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
                  defaultValue={editEvent?.description ?? ""}
                  placeholder="Notas adicionales..."
                  className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                />
                <div className="mt-2">
                  <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} />
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
