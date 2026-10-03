"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_SETTLE } from "@/lib/motion";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";

export interface SerializedAgency {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  /** Movimientos compartidos que la referencian. */
  entriesCount: number;
}

interface Props {
  initialAgencies: SerializedAgency[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  filterQ: string;
}

const inputClass =
  "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";

export function InmobiliariasClient({
  initialAgencies,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  filterQ,
}: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [agencies, setAgencies] = useState(initialAgencies);
  // Re-sincronizar cuando el server manda otra data (búsqueda / paginación).
  const [syncedInitial, setSyncedInitial] = useState(initialAgencies);
  if (syncedInitial !== initialAgencies) {
    setSyncedInitial(initialAgencies);
    setAgencies(initialAgencies);
  }
  const [editing, setEditing] = useState<SerializedAgency | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SerializedAgency | null>(null);

  // Búsqueda con debounce (350 ms) → query param `q`.
  const [search, setSearch] = useState(filterQ);
  useEffect(() => {
    const value = search.trim();
    if (value === filterQ) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(id: string) {
    setToDelete(null);
    try {
      const res = await fetch(`/api/inmobiliarias/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      setAgencies((prev) => prev.filter((a) => a.id !== id));
      toast.success("Inmobiliaria eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  function openEdit(a: SerializedAgency) {
    setEditing(a);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Inmobiliarias</h1>
          <p className="text-[12.5px] text-text-faint">
            {total} inmobiliaria{total !== 1 ? "s" : ""} · otras agencias con las que se comparten movimientos
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva inmobiliaria
        </button>
      </header>

      <div className={`relative transition-opacity ${pending ? "opacity-70" : ""}`}>
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, dirección o teléfono…"
          className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
      </div>

      {agencies.length === 0 ? (
        <p className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
          {filterQ ? "Sin resultados" : "Todavía no hay inmobiliarias cargadas."}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-1.5 sm:hidden">
            <AnimatePresence>
              {agencies.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => openEdit(a)}
                  className="cursor-pointer overflow-hidden rounded-[18px] border border-border bg-surface transition-colors active:bg-bg"
                >
                  <div className="p-3">
                    <p className="text-[13.5px] font-bold leading-tight text-text">{a.name}</p>
                    {a.address && <p className="mt-0.5 text-[11.5px] text-text-muted">{a.address}</p>}
                    {a.phone && (
                      <div className="mt-2 text-[11px]">
                        <WhatsAppLink phone={a.phone} className="inline-flex items-center gap-1 font-bold text-olive-light">
                          {a.phone}
                        </WhatsAppLink>
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11.5px] font-bold ${a.entriesCount > 0 ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {a.entriesCount > 0
                      ? `${a.entriesCount} movimiento${a.entriesCount !== 1 ? "s" : ""} compartido${a.entriesCount !== 1 ? "s" : ""}`
                      : "Sin movimientos"}
                    {isAdmin && a.entriesCount === 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(a);
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-terra"
                      >
                        <TrashIcon />
                        Eliminar
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Nombre</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Dirección</th>
                  <th className="hidden px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint md:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Movimientos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {agencies.map((a) => (
                    <motion.tr
                      key={a.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-t border-border transition-colors hover:bg-bg"
                    >
                      <td className="px-4 py-2.5 text-[13.5px] font-bold text-text">{a.name}</td>
                      <td className="px-4 py-2.5 text-xs text-text-muted">{a.address ?? <span className="text-text-faint">—</span>}</td>
                      <td className="hidden px-4 py-2.5 text-xs text-text-muted md:table-cell">
                        {a.phone ? (
                          <WhatsAppLink
                            phone={a.phone}
                            className="inline-flex items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-bold text-olive-light transition-opacity hover:opacity-80"
                          >
                            {a.phone}
                          </WhatsAppLink>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${a.entriesCount > 0 ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                          {a.entriesCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label="Editar"
                            onClick={() => openEdit(a)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-text-muted transition-colors hover:text-text"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          {isAdmin && a.entriesCount === 0 && (
                            <button
                              type="button"
                              aria-label="Eliminar"
                              onClick={() => setToDelete(a)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80"
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} startTransition={startTransition} />

      {/* Confirmación — Eliminar */}
      <AnimatePresence>
        {toDelete && (
          <>
            <motion.div
              key="confirm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-scrim backdrop-blur-sm"
              onClick={() => setToDelete(null)}
            />
            <motion.div
              key="confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={SPRING_SETTLE}
              className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
            >
              <p className="font-display text-[17px] font-semibold text-text">¿Eliminar inmobiliaria?</p>
              <p className="mt-1 text-[13px] text-text-muted">
                Se eliminará <span className="font-semibold text-text">{toDelete.name}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setToDelete(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleDelete(toDelete.id)}
                  className="h-10 rounded-full bg-terra px-5 text-[13px] font-bold text-white transition-opacity active:opacity-90"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AgencyFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={(agency) => {
          setAgencies((prev) => {
            const idx = prev.findIndex((a) => a.id === agency.id);
            if (idx === -1) return [agency, ...prev];
            const next = [...prev];
            next[idx] = agency;
            return next;
          });
        }}
      />
    </div>
  );
}

function TrashIcon({ size = 12 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

interface AgencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SerializedAgency | null;
  onSaved: (agency: SerializedAgency) => void;
}

function AgencyFormDialog({ open, onOpenChange, editing, onSaved }: Readonly<AgencyFormDialogProps>) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset del form al abrir.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAddress(editing?.address ?? "");
    setPhone(editing?.phone ?? "");
  }, [open, editing]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Falta el nombre");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
      };
      const res = await fetch(editing ? `/api/inmobiliarias/${editing.id}` : "/api/inmobiliarias", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onSaved({
        id: body.data.id,
        name: body.data.name,
        address: body.data.address ?? null,
        phone: body.data.phone ?? null,
        entriesCount: editing?.entriesCount ?? 0,
      });
      toast.success(editing ? "Inmobiliaria actualizada" : "Inmobiliaria creada");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={editing ? "Editar inmobiliaria" : "Nueva inmobiliaria"}
      maxWidth="sm:max-w-[520px]"
      footer={
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-2 text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Ej. Inmobiliaria García"
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
            Dirección <span className="text-text-faint">(opcional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle y número, ciudad"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
            Teléfono <span className="text-text-faint">(opcional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej. 11 5555-5555"
            className={inputClass}
          />
        </div>
      </div>
    </Sheet>
  );
}
