"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select-field";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Spinner } from "../../_components/spinner";
import { Sheet } from "../../_components/sheet";
import { formatDate } from "@/lib/datetime";

interface TasacionItem {
  id: string;
  titulo: string;
  direccion: string;
  status: string;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  items: TasacionItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  filters: { q: string; status: string; from: string; to: string };
}

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  borrador: { label: "Borrador", pill: "bg-sand-chip text-warning" },
  completada: { label: "Completada", pill: "bg-sage-chip text-olive-light" },
};

export function TasacionesClient({ items, page, totalPages, total, limit, isAdmin, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(filters.q);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [fromDate, setFromDate] = useState(filters.from);
  const [toDate, setToDate] = useState(filters.to);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newDireccion, setNewDireccion] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (statusFilter) params.set("status", statusFilter);
    else params.delete("status");
    if (fromDate) params.set("from", fromDate);
    else params.delete("from");
    if (toDate) params.set("to", toDate);
    else params.delete("to");
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleCreate() {
    if (!newDireccion.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch("/api/tasaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direccion: newDireccion.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "Error al crear tasación");
        return;
      }
      toast.success("Tasación creada");
      setNewDireccion("");
      setCreateOpen(false);
      router.push(`/tasaciones/${body.data.id}`);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("¿Estás seguro de que querés eliminar esta tasación?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tasaciones/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message ?? "Error al eliminar");
        return;
      }
      toast.success("Tasación eliminada");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Tasaciones</h1>
          <p className="text-[12.5px] text-text-faint">
            {total} tasaci{total !== 1 ? "ones" : "ón"} registrada{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva tasación
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[200px]">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por dirección..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
            className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
        </div>
        <SelectField
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          wrapperClassName="min-w-0"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="completada">Completada</option>
        </SelectField>
        <DatePicker
          value={fromDate}
          onChange={setFromDate}
          aria-label="Desde"
          className="h-11 min-w-0 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
        />
        <DatePicker
          value={toDate}
          onChange={setToDate}
          aria-label="Hasta"
          className="h-11 min-w-0 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
        />
        <button
          onClick={() => applyFilters(1)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90"
        >
          Buscar
        </button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            {filters.q || filters.status ? "Sin resultados" : "No hay tasaciones creadas"}
          </div>
        ) : (
          items.map((t) => {
            const sc = STATUS_CONFIG[t.status] ?? { label: t.status, pill: "bg-bg text-text-faint" };
            return (
              <Link key={t.id} href={`/tasaciones/${t.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-[18px] border border-border bg-surface p-3.5 transition-colors active:bg-bg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-text">{t.direccion}</p>
                      <p className="mt-0.5 text-[11.5px] text-text-faint">
                        {formatDate(t.createdAt)}{t.userName ? ` · ${t.userName}` : ""}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.pill}`}>
                      {sc.label}
                    </span>
                  </div>
                </motion.div>
              </Link>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[20px] border border-border bg-surface sm:block">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
              <th className="px-4 py-3">Dirección</th>
              <th className="px-4 py-3">Estado</th>
              {isAdmin && <th className="px-4 py-3">Creador</th>}
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-12 text-center text-[12.5px] text-text-faint">
                  {filters.q || filters.status ? "Sin resultados" : "No hay tasaciones creadas"}
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const sc = STATUS_CONFIG[t.status] ?? { label: t.status, pill: "bg-bg text-text-faint" };
                return (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tasaciones/${t.id}`)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-bg"
                  >
                    <td className="px-4 py-3.5">
                      <p className="text-[13.5px] font-bold text-text">{t.direccion}</p>
                      {t.titulo !== t.direccion && (
                        <p className="text-[11.5px] text-text-faint">{t.titulo}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.pill}`}>
                        {sc.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-[13px] text-text-muted">{t.userName ?? "—"}</td>
                    )}
                    <td className="px-4 py-3.5 text-[13px] text-text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={`/api/tasaciones/${t.id}/pdf`}
                          onClick={(e) => e.stopPropagation()}
                          title="Descargar PDF"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand-chip text-warning transition-opacity hover:opacity-80"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </a>
                        <button
                          onClick={(e) => handleDelete(e, t.id)}
                          disabled={deletingId === t.id}
                          title="Eliminar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {deletingId === t.id ? <Spinner variant="red" size={12} /> : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {/* Create modal */}
      <Sheet
        open={createOpen}
        onClose={() => { setCreateOpen(false); setNewDireccion(""); }}
        title="Nueva tasación"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <button
              onClick={() => { setCreateOpen(false); setNewDireccion(""); }}
              className="px-2 text-[13px] font-semibold text-text-faint hover:text-text"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !newDireccion.trim()}
              className="inline-flex h-11 items-center justify-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createLoading ? <Spinner /> : "Crear y editar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[12.5px] text-text-faint">
            Ingresá la dirección de la propiedad para comenzar la tasación.
          </p>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Dirección *</label>
            <input
              value={newDireccion}
              onChange={(e) => setNewDireccion(e.target.value)}
              placeholder="San Martin 870 - Quilmes"
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
