"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { SelectField } from "@/components/ui/select-field";
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
  // Re-sincronizar cuando el server manda otra data (búsqueda / paginación):
  // useState() no reinicia solo al cambiar el prop.
  const [syncedInitial, setSyncedInitial] = useState(initialTenants);
  if (syncedInitial !== initialTenants) {
    setSyncedInitial(initialTenants);
    setTenants(initialTenants);
  }
  const [editing, setEditing] = useState<SerializedTenant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SerializedTenant | null>(null);

  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  async function handleDelete(id: string) {
    setToDelete(null);
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
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Inquilinos</h1>
          <p className="text-[12.5px] text-text-faint">
            {total} inquilino{total !== 1 ? "s" : ""} cargado{total !== 1 ? "s" : ""}
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

      <div className={`relative transition-opacity ${pending ? "opacity-70" : ""}`}>
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
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
          className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
      </div>

      {tenants.length === 0 ? (
        <p className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
          {filterQ ? "Sin resultados" : "Todavía no hay inquilinos cargados."}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-1.5 sm:hidden">
            <AnimatePresence>
              {tenants.map((t) => {
                const hasContracts = t.contractsCount > 0;
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      setEditing(t);
                      setCreateOpen(true);
                    }}
                    className="cursor-pointer overflow-hidden rounded-[18px] border border-border bg-surface transition-colors active:bg-bg"
                  >
                    <div className="p-3">
                      <p className="text-[13.5px] font-bold leading-tight text-text">{t.fullName}</p>
                      <p className="mt-0.5 text-[11px] text-text-faint">
                        <span className="font-bold uppercase tracking-[0.12em]">{t.idType}</span> {t.idNumber}
                      </p>
                      {t.notes?.trim() && <p className="mt-1.5 line-clamp-1 text-[12px] text-text-muted">{t.notes}</p>}
                      {(t.phone || t.email) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                          {t.phone && (
                            <WhatsAppLink phone={t.phone} className="inline-flex items-center gap-1 font-bold text-olive-light">
                              {t.phone}
                            </WhatsAppLink>
                          )}
                          {t.email && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-10 7L2 7" />
                              </svg>
                              <span className="truncate">{t.email}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11.5px] font-bold ${hasContracts ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {hasContracts ? `${t.contractsCount} contrato${t.contractsCount !== 1 ? "s" : ""}` : "Sin contratos"}
                      {isAdmin && !hasContracts && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(t);
                          }}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-terra"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface sm:block">
          <table className="w-full text-sm">
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
                            onClick={() => setToDelete(t)}
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
        </>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {/* Modal de confirmación — Eliminar */}
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
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
            >
              <p className="font-display text-[17px] font-semibold text-text">¿Eliminar inquilino?</p>
              <p className="mt-1 text-[13px] text-text-muted">
                Se eliminará a <span className="font-semibold text-text">{toDelete.fullName}</span>. Esta acción no se puede deshacer.
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

  // Reset del form al abrir (antes se hacía en onOpenChange de Radix).
  useEffect(() => {
    if (!open) return;
    setFullName(editing?.fullName ?? "");
    setIdType((editing?.idType as "dni" | "cuit") ?? "dni");
    setIdNumber(editing?.idNumber ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setNotes(editing?.notes ?? "");
    setAttachments(editing?.attachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={editing ? "Editar inquilino" : "Nuevo inquilino"}
      maxWidth="sm:max-w-[540px]"
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
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
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
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
              Tipo
            </label>
            <SelectField
              wrapperClassName="w-full"
              value={idType}
              onChange={(e) => setIdType(e.target.value as "dni" | "cuit")}
            >
              <option value="dni">DNI</option>
              <option value="cuit">CUIT</option>
            </SelectField>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
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
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
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
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
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
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
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
          <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
            Audio / adjuntos <span className="text-text-faint">(opcional)</span>
          </label>
          <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} />
        </div>
      </div>
    </Sheet>
  );
}
