"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pagination } from "../../_components/pagination";
import { FirmaCard } from "./firma-card";
import { FirmaDetailModal } from "./firma-detail-modal";
import { CreateFirmaModal, type PropertyOption } from "./create-firma-modal";
import {
  SIGNATURE_STATUSES,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_STYLE,
  type SignatureStatus,
} from "@/lib/signatures";
import type { SerializedFirma } from "./types";

interface FirmasClientProps {
  initialFirmas: SerializedFirma[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  currentUserId: string;
  properties: PropertyOption[];
  filters: {
    q: string;
    status: string;
    propertyId: string;
  };
  kpis: {
    total: number;
    inProgress: number;
    successful: number;
    rejected: number;
  };
}

export function FirmasClient({
  initialFirmas,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  currentUserId,
  properties,
  filters,
  kpis,
}: Readonly<FirmasClientProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [firmas, setFirmas] = useState<SerializedFirma[]>(initialFirmas);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<SerializedFirma | null>(null);

  function updateFilters(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function handleOpen(firma: SerializedFirma) {
    setActive(firma);
    setDetailOpen(true);
  }

  function handleUpdated(next: SerializedFirma) {
    setFirmas((prev) => prev.map((f) => (f.id === next.id ? next : f)));
    setActive((prev) => (prev?.id === next.id ? next : prev));
  }

  function handleDeleted(id: string) {
    setFirmas((prev) => prev.filter((f) => f.id !== id));
    setActive(null);
  }

  function handleCreated(firma: SerializedFirma) {
    setFirmas((prev) => [firma, ...prev]);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-text md:text-3xl">Estado de firmas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Seguimiento del proceso de cierre de cada propiedad. Todo el equipo lo ve y lo edita.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva propuesta
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Total" value={kpis.total.toString()} hint="todas las propuestas" tone="text-text" />
        <KPICard label="En proceso" value={kpis.inProgress.toString()} hint="activas (no cerradas)" tone="text-olive-light" />
        <KPICard label="Concretadas" value={kpis.successful.toString()} hint="entrega de llaves" tone="text-emerald-300" />
        <KPICard label="Rechazadas" value={kpis.rejected.toString()} hint="propuestas caídas" tone="text-red-300" />
      </div>

      {/* Filters */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-3 transition-opacity sm:flex-row sm:items-end ${pending ? "opacity-70" : ""}`}
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Buscar
          </span>
          <input
            type="text"
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q: (e.target as HTMLInputElement).value });
            }}
            onBlur={(e) => {
              if (e.target.value !== filters.q) updateFilters({ q: e.target.value });
            }}
            placeholder="Dirección, título o descripción…"
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:min-w-[200px]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Estado
          </span>
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          >
            <option value="">Todos los estados</option>
            {SIGNATURE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SIGNATURE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        {(filters.q || filters.status || filters.propertyId) && (
          <button
            type="button"
            onClick={() => updateFilters({ q: null, status: null, propertyId: null })}
            className="h-10 rounded-xl border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-colors hover:border-olive-bright/40 hover:text-text"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Active chips for status when filtered */}
      {filters.status && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-faint">Filtrando por:</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SIGNATURE_STATUS_STYLE[filters.status as SignatureStatus]?.chip ?? ""}`}
          >
            {SIGNATURE_STATUS_LABEL[filters.status as SignatureStatus] ?? filters.status}
          </span>
        </div>
      )}

      {/* Grid / empty */}
      {firmas.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {firmas.map((firma) => (
              <FirmaCard key={firma.id} firma={firma} onOpen={handleOpen} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      <CreateFirmaModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        properties={properties}
        onCreated={handleCreated}
      />
      <FirmaDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        firma={active}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function KPICard({
  label,
  value,
  hint,
  tone,
}: Readonly<{ label: string; value: string; hint: string; tone: string }>) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-display text-2xl leading-none md:text-3xl ${tone}`}>{value}</p>
      <p className="text-[11px] text-text-faint">{hint}</p>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border-olive bg-olive-subtle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-olive-light">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      </div>
      <div>
        <p className="font-display text-lg text-text">Sin propuestas todavía</p>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Cuando arranques un proceso de firma para una propiedad, lo vas a ver acá.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid"
      >
        Crear la primera
      </button>
    </div>
  );
}
