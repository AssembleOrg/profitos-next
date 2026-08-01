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
  type SignatureStatus,
} from "@/lib/signatures";
import type { SerializedFirma } from "./types";

/** Pills de estado V4 (tinte por estado). */
const STATUS_PILL: Record<SignatureStatus, string> = {
  propuesta_enviada: "bg-info-chip text-info",
  propuesta_aceptada: "bg-sage-chip text-olive-light",
  propuesta_rechazada: "bg-clay-chip text-terra",
  espera_informes: "bg-info-chip text-info",
  comunicacion_partes_finales: "bg-info-chip text-info",
  fecha_acordada: "bg-sand-chip text-warning",
  entrega_llaves: "bg-sage-chip text-olive-light",
};

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
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Estado de firmas</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Seguimiento del proceso de cierre de cada propiedad. Todo el equipo lo ve y lo edita.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva propuesta
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Total" value={kpis.total.toString()} hint="todas las propuestas" tone="text-text" bg="border border-border bg-surface" />
        <KPICard label="En proceso" value={kpis.inProgress.toString()} hint="activas (no cerradas)" tone="text-info" bg="bg-info-chip" />
        <KPICard label="Concretadas" value={kpis.successful.toString()} hint="entrega de llaves" tone="text-olive-light" bg="bg-sage-chip" />
        <KPICard label="Rechazadas" value={kpis.rejected.toString()} hint="propuestas caídas" tone="text-terra" bg="bg-clay-chip" />
      </div>

      {/* Filters */}
      <div
        className={`flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4 transition-opacity sm:flex-row sm:items-end ${pending ? "opacity-70" : ""}`}
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
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
            className="h-11 rounded-full border border-border bg-surface px-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:min-w-[200px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
            Estado
          </span>
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="h-11 appearance-none rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none [color-scheme:light]"
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
            className="h-11 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
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
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_PILL[filters.status as SignatureStatus] ?? "bg-bg text-text-faint"}`}
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
  bg,
}: Readonly<{ label: string; value: string; hint: string; tone: string; bg: string }>) {
  return (
    <div className={`flex flex-col gap-1 rounded-[18px] p-4 ${bg}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{label}</p>
      <p className={`font-display text-2xl font-bold leading-none md:text-3xl ${tone}`}>{value}</p>
      <p className="text-[11px] text-text-faint">{hint}</p>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-bg px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-chip">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      </div>
      <div>
        <p className="font-display text-[15px] font-semibold text-text">Sin propuestas todavía</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-text-faint">
          Cuando arranques un proceso de firma para una propiedad, lo vas a ver acá.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-surface/70"
      >
        Crear la primera
      </button>
    </div>
  );
}
