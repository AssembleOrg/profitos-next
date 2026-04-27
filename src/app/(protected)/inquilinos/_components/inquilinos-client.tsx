"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { Pagination } from "../../_components/pagination";

export interface SerializedTenant {
  id: string;
  fullName: string;
  idType: string;
  idNumber: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
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
          <h1 className="font-display text-2xl text-text md:text-3xl">Inquilinos</h1>
          <p className="mt-1 text-sm text-text-muted">
            Personas o empresas con contratos de alquiler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo inquilino
        </button>
      </header>

      <div className={`flex items-center gap-3 rounded-2xl border border-border bg-surface/40 p-3 transition-opacity ${pending ? "opacity-70" : ""}`}>
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
          className="h-10 flex-1 rounded-xl border border-border bg-bg px-3 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
        />
      </div>

      {tenants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center text-sm text-text-muted">
          {filterQ ? "Sin resultados" : "Todavía no hay inquilinos cargados."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* Mobile cards */}
          <div className="flex flex-col divide-y divide-border/60 sm:hidden">
            <AnimatePresence>
              {tenants.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-2 bg-bg/30 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text">{t.fullName}</p>
                      <p className="font-mono text-xs text-text-muted">
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase">{t.idType}</span>{" "}
                        {t.idNumber}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {t.contractsCount} contrato{t.contractsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {(t.phone || t.email) && (
                    <div className="flex flex-col gap-0.5">
                      {t.phone && <span className="text-xs text-text-muted">{t.phone}</span>}
                      {t.email && <span className="text-xs text-text-faint">{t.email}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setCreateOpen(true);
                      }}
                      className="rounded-md border border-border px-3 py-2 text-xs text-text-muted transition-colors active:bg-surface active:text-text"
                    >
                      Editar
                    </button>
                    {isAdmin && t.contractsCount === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.fullName)}
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition-colors active:bg-red-500/20"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead className="bg-surface/40 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left">Nombre</th>
                <th className="px-4 py-2.5 text-left">Documento</th>
                <th className="hidden px-4 py-2.5 text-left md:table-cell">Contacto</th>
                <th className="px-4 py-2.5 text-right">Contratos</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-bg/30">
              <AnimatePresence>
                {tenants.map((t) => (
                  <motion.tr
                    key={t.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="transition-colors hover:bg-surface/40"
                  >
                    <td className="px-4 py-2.5 text-text">{t.fullName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase">{t.idType}</span>{" "}
                      {t.idNumber}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-text-muted md:table-cell">
                      <div className="flex flex-col">
                        {t.phone && <span>{t.phone}</span>}
                        {t.email && <span className="text-text-faint">{t.email}</span>}
                        {!t.phone && !t.email && <span className="text-text-faint">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <span className="font-mono text-text">{t.contractsCount}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(t);
                            setCreateOpen(true);
                          }}
                          className="rounded-md border border-border px-3 py-2 text-[11px] text-text-muted transition-colors hover:bg-surface hover:text-text"
                        >
                          Editar
                        </button>
                        {isAdmin && t.contractsCount === 0 && (
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id, t.fullName)}
                            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 transition-colors hover:bg-red-500/20"
                          >
                            Eliminar
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
  const [submitting, setSubmitting] = useState(false);

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
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(540px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <Dialog.Title className="text-base font-semibold text-text">
                    {editing ? "Editar inquilino" : "Nuevo inquilino"}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text"
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
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Tipo
                        </label>
                        <select
                          value={idType}
                          onChange={(e) => setIdType(e.target.value as "dni" | "cuit")}
                          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
                        >
                          <option value="dni">DNI</option>
                          <option value="cuit">CUIT</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Número
                        </label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Email <span className="text-text-faint">(opcional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Notas <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
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
