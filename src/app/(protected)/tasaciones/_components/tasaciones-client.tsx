"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-amber-500" },
  completada: { label: "Completada", color: "bg-emerald-500" },
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
          <h1 className="font-display text-2xl font-medium text-text">Tasaciones</h1>
          <p className="text-sm text-text-muted">
            {total} tasaci{total !== 1 ? "ones" : "ón"} registrada{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva tasación
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por dirección..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
            className="w-full rounded-xl border border-border bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-0 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="completada">Completada</option>
        </select>
        <DatePicker
          value={fromDate}
          onChange={setFromDate}
          aria-label="Desde"
          className="min-w-0 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none"
        />
        <DatePicker
          value={toDate}
          onChange={setToDate}
          aria-label="Hasta"
          className="min-w-0 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none"
        />
        <button
          onClick={() => applyFilters(1)}
          className="shrink-0 rounded-xl bg-secondary/20 px-4 py-2.5 text-sm font-medium text-secondary hover:bg-secondary/30"
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
            const sc = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-text-muted" };
            return (
              <Link key={t.id} href={`/tasaciones/${t.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-xl border border-border bg-surface/30 p-4 active:bg-surface/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{t.direccion}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatDate(t.createdAt)}{t.userName ? ` · ${t.userName}` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.color}`} />
                      <span className="text-xs text-text-muted">{sc.label}</span>
                    </span>
                  </div>
                </motion.div>
              </Link>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface/30 sm:block">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
              <th className="px-5 py-3">Dirección</th>
              <th className="px-5 py-3">Estado</th>
              {isAdmin && <th className="px-5 py-3">Creador</th>}
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-5 py-12 text-center text-sm text-text-muted">
                  {filters.q || filters.status ? "Sin resultados" : "No hay tasaciones creadas"}
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const sc = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-text-muted" };
                return (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tasaciones/${t.id}`)}
                    className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-surface/50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text">{t.direccion}</p>
                      {t.titulo !== t.direccion && (
                        <p className="text-xs text-text-muted">{t.titulo}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.color}`} />
                        <span className="text-text-muted">{sc.label}</span>
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-text-muted">{t.userName ?? "—"}</td>
                    )}
                    <td className="px-5 py-3.5 text-text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={`/api/tasaciones/${t.id}/pdf`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg hover:text-text"
                        >
                          PDF
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </a>
                        <button
                          onClick={(e) => handleDelete(e, t.id)}
                          disabled={deletingId === t.id}
                          className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {deletingId === t.id ? <Spinner variant="red" size={12} /> : "Eliminar"}
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
          <div className="flex w-full gap-3">
            <button
              onClick={() => { setCreateOpen(false); setNewDireccion(""); }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !newDireccion.trim()}
              className="flex flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-text hover:bg-primary-hover disabled:opacity-50"
            >
              {createLoading ? <Spinner /> : "Crear y editar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Ingresá la dirección de la propiedad para comenzar la tasación.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Dirección *</label>
            <input
              value={newDireccion}
              onChange={(e) => setNewDireccion(e.target.value)}
              placeholder="San Martin 870 - Quilmes"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
