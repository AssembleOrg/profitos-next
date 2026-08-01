"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { MediaUploader, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";

export interface SerializedTenant {
  id: string;
  fullName: string;
  idType: string;
  idNumber: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  attachments: NoteAttachment[] | null;
  contractsCount: number;
  createdAt: string;
}

interface InquilinosClientProps {
  initialTenants: SerializedTenant[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  filterQ: string;
}

export function InquilinosClient({
  initialTenants,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  filterQ,
}: Readonly<InquilinosClientProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [tenants, setTenants] = useState(initialTenants);
  const [editing, setEditing] = useState<SerializedTenant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar al inquilino "${name}"? Esta acción es irreversible.`)) return;
    try {
      const res = await fetch(`/api/inquilinos/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      setTenants((prev) => prev.filter((t) => t.id !== id));
      toast.success("Inquilino eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Inquilinos</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Personas o empresas con contratos de alquiler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreateOpen(true);
          }}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo inquilino
        </button>
      </header>

      <div className={`flex items-center transition-opacity ${pending ? "opacity-70" : ""}`}>
        <input
          type="text"
          defaultValue={filterQ}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateQuery((e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => {
            if (e.target.value !== filterQ) updateQuery(e.target.value);
          }}
          placeholder="Buscar por nombre, DNI/CUIT, teléfono o email…"
          className="h-11 flex-1 rounded-full border border-border bg-surface pl-4 pr-3 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
      </div>

      {tenants.length === 0 ? (
        <p className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
          {filterQ ? "Sin resultados" : "Todavía no hay inquilinos cargados."}
        </p>
      ) : (
        <div className="sm:overflow-hidden sm:rounded-[20px] sm:border sm:border-border sm:bg-surface">
          {/* Mobile cards */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            <AnimatePresence>
              {tenants.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-2 rounded-[18px] border border-border bg-surface p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-bold text-text">{t.fullName}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-bg px-2 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-faint">{t.idType}</span>
                        <span className="font-display text-[12px] font-bold text-text">{t.idNumber}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${t.contractsCount > 0 ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                      {t.contractsCount} contrato{t.contractsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {(t.phone || t.email) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.phone && (
                        <WhatsAppLink
                          phone={t.phone}
                          className="inline-flex items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-bold text-olive-light transition-opacity hover:opacity-80"
                        >
                          {t.phone}
                        </WhatsAppLink>
                      )}
                      {t.email && <span className="text-xs text-text-faint">{t.email}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => {
                        setEditing(t);
                        setCreateOpen(true);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-text-muted transition-colors active:text-text"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    {isAdmin && t.contractsCount === 0 && (
                      <button
                        type="button"
                        aria-label="Eliminar"
                        onClick={() => handleDelete(t.id, t.fullName)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity active:opacity-80"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Nombre</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Documento</th>
                <th className="hidden px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint md:table-cell">Contacto</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Contratos</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {tenants.map((t) => (
                  <motion.tr
                    key={t.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-t border-border transition-colors hover:bg-bg"
                  >
                    <td className="px-4 py-2.5 text-[13.5px] font-bold text-text">{t.fullName}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-bg px-2 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-faint">{t.idType}</span>
                        <span className="font-display text-[12px] font-bold text-text">{t.idNumber}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-text-muted md:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        {t.phone && (
                          <WhatsAppLink
                            phone={t.phone}
                            className="inline-flex items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-bold text-olive-light transition-opacity hover:opacity-80"
                          >
                            {t.phone}
                          </WhatsAppLink>
                        )}
                        {t.email && <span className="text-[11.5px] text-text-faint">{t.email}</span>}
                        {!t.phone && !t.email && <span className="text-text-faint">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${t.contractsCount > 0 ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                        {t.contractsCount}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => {
                            setEditing(t);
                            setCreateOpen(true);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-text-muted transition-colors hover:text-text"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        {isAdmin && t.contractsCount === 0 && (
                          <button
                            type="button"
                            aria-label="Eliminar"
                            onClick={() => handleDelete(t.id, t.fullName)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      <TenantFormDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={(tenant) => {
          setTenants((prev) => {
            const idx = prev.findIndex((t) => t.id === tenant.id);
            if (idx === -1) return [tenant, ...prev];
            const next = [...prev];
            next[idx] = tenant;
            return next;
          });
        }}
      />
    </div>
  );
}

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SerializedTenant | null;
  onSaved: (tenant: SerializedTenant) => void;
}

function TenantFormDialog({ open, onOpenChange, editing, onSaved }: Readonly<TenantFormDialogProps>) {
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<"dni" | "cuit">("dni");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const signedUrls = useNoteSignedUrls(attachments.map((a) => a.path));

  // Sync form when opening/editing
  if (open && editing && editing.id !== "__internal_synced__") {
    // simple field sync — using state ref pattern via key would be cleaner, mantengo simple
  }

  async function submit() {
    if (!fullName.trim()) {
      toast.error("Falta el nombre");
      return;
    }
    if (!idNumber.trim()) {
      toast.error("Falta el documento");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        idType,
        idNumber: idNumber.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        attachments,
      };
      const res = await fetch(editing ? `/api/inquilinos/${editing.id}` : "/api/inquilinos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const tenant: SerializedTenant = {
        id: body.data.id,
        fullName: body.data.fullName,
        idType: body.data.idType,
        idNumber: body.data.idNumber,
        phone: body.data.phone,
        email: body.data.email,
        notes: body.data.notes,
        attachments: body.data.attachments ?? null,
        contractsCount: editing?.contractsCount ?? 0,
        createdAt: body.data.createdAt,
      };
      onSaved(tenant);
      toast.success(editing ? "Inquilino actualizado" : "Inquilino creado");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setFullName(editing?.fullName ?? "");
          setIdType((editing?.idType as "dni" | "cuit") ?? "dni");
          setIdNumber(editing?.idNumber ?? "");
          setPhone(editing?.phone ?? "");
          setEmail(editing?.email ?? "");
          setNotes(editing?.notes ?? "");
          setAttachments(editing?.attachments ?? []);
        }
        onOpenChange(next);
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(540px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <Dialog.Title className="font-display text-[17px] font-semibold text-text">
                    {editing ? "Editar inquilino" : "Nuevo inquilino"}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-bg hover:text-text"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                          Tipo
                        </label>
                        <select
                          value={idType}
                          onChange={(e) => setIdType(e.target.value as "dni" | "cuit")}
                          className="h-11 w-full appearance-none rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                        >
                          <option value="dni">DNI</option>
                          <option value="cuit">CUIT</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                          Número
                        </label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Email <span className="text-text-faint">(opcional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Notas <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Audio / adjuntos <span className="text-text-faint">(opcional)</span>
                      </label>
                      <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} />
                    </div>
                  </div>
                </div>

                <footer className="flex items-center justify-end gap-3 border-t border-border px-5 py-3 pt-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-2 text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
                  </button>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
