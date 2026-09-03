"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatDate, formatRelative } from "@/lib/datetime";
import {
  RENTAL_FREQUENCY_LABEL,
  RENTAL_DUE_STATUS_LABEL,
  RENTAL_DUE_STATUS_STYLE,
  formatARS,
  getDueEffectiveStatus,
  summarizeDueDates,
  type RentalDueEffectiveStatus,
} from "@/lib/rentals";
import { ContractWizard } from "./contract-wizard";
import { DueDetailModal } from "./due-detail-modal";
import type {
  CobrosContractHeader,
  RentalAdditionalCatalogItem,
  RentalDueSummary,
  RentalProperty,
  RentalTenant,
  SerializedContract,
  SerializedDueDate,
} from "./types";

interface AlquileresClientProps {
  initialContracts: SerializedContract[];
  cobrosHeaders?: CobrosContractHeader[];
  kpis?: RentalDueSummary;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  currentUserId: string;
  properties: RentalProperty[];
  tenants: RentalTenant[];
  additionalsCatalog: RentalAdditionalCatalogItem[];
  filterQ: string;
  tab: "contratos" | "cobros";
}

export function AlquileresClient({
  initialContracts,
  cobrosHeaders = [],
  kpis,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  currentUserId,
  properties,
  tenants,
  additionalsCatalog,
  filterQ,
  tab,
}: Readonly<AlquileresClientProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [contracts, setContracts] = useState(initialContracts);
  const [detailContract, setDetailContract] = useState<SerializedContract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedContract | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Re-sincronizar cuando el server manda otra data (cambio de tab / refresh):
  // useState() no reinicia solo al cambiar el prop, y la tab Cobros manda [].
  const [syncedInitial, setSyncedInitial] = useState(initialContracts);
  if (syncedInitial !== initialContracts) {
    setSyncedInitial(initialContracts);
    setContracts(initialContracts);
  }
  const [tenantList, setTenantList] = useState(tenants);
  const [propertyList, setPropertyList] = useState(properties);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Detail modal state
  const [activeDue, setActiveDue] = useState<SerializedDueDate | null>(null);
  const [activeContract, setActiveContract] = useState<SerializedContract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Lazy-load de cuotas por contrato (pestaña Cobros).
  const [loadedContracts, setLoadedContracts] = useState<Record<string, SerializedContract>>({});
  const [loadingContractIds, setLoadingContractIds] = useState<Set<string>>(new Set());

  async function loadContractDetail(id: string) {
    if (loadedContracts[id] || loadingContractIds.has(id)) return;
    setLoadingContractIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/alquileres/${id}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "No se pudo cargar el contrato");
      setLoadedContracts((prev) => ({ ...prev, [id]: body.data as SerializedContract }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar las cuotas");
    } finally {
      setLoadingContractIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const aggregatedKpis = useMemo(() => {
    if (kpis) return kpis;
    const allDues = contracts.flatMap((c) =>
      c.dueDates.map((d) => ({
        ...d,
        gracePeriodDays: c.gracePeriodDays,
      })),
    );
    return summarizeDueDates(allDues, 0);
  }, [contracts, kpis]);

  function updateQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function openDue(contract: SerializedContract, due: SerializedDueDate) {
    setActiveContract(contract);
    setActiveDue(due);
    setDetailOpen(true);
  }

  function handleDueUpdated(next: SerializedDueDate) {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === next.contractId
          ? { ...c, dueDates: c.dueDates.map((d) => (d.id === next.id ? next : d)) }
          : c,
      ),
    );
    // Parchear el contrato lazy-cargado (pestaña Cobros).
    setLoadedContracts((prev) => {
      const c = prev[next.contractId];
      if (!c) return prev;
      return {
        ...prev,
        [next.contractId]: { ...c, dueDates: c.dueDates.map((d) => (d.id === next.id ? next : d)) },
      };
    });
    setActiveDue(next);
    // Refrescar los resúmenes/KPIs calculados en el server.
    router.refresh();
  }

  function handleContractCreated(contract: SerializedContract) {
    setContracts((prev) => [contract, ...prev]);
    toast.success(`Contrato creado · ${contract.dueDates.length} cuotas generadas`);
    router.refresh();
  }

  function handleContractDelete(contract: SerializedContract) {
    setDeleteTarget(contract);
    setDeleteConfirmText("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/alquileres/${deleteTarget.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Contrato eliminado");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Alquileres temporales</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Contratos, cuotas y cobros con generación automática de comprobantes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo contrato
        </button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Cobrado" value={formatARS(aggregatedKpis.collectedTotal)} hint="suma de pagos" tone="text-olive-light" surface="bg-sage-chip" />
        <KPI label="Esperado" value={formatARS(aggregatedKpis.expectedTotal)} hint="todas las cuotas" tone="text-text" surface="border border-border bg-surface" />
        <KPI label="Vencidos" value={aggregatedKpis.counts.vencido.toString()} hint="cuotas sin pago" tone="text-terra" surface="bg-clay-chip" />
        <KPI label="Comisión" value={formatARS(aggregatedKpis.commissionTotal)} hint="ingresos inmobiliaria" tone="text-text" surface="bg-sand-chip" />
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-0.5 self-start rounded-full border border-border bg-surface p-1">
        <TabButton active={tab === "contratos"} onClick={() => updateQuery({ tab: null })}>
          Contratos
        </TabButton>
        <TabButton active={tab === "cobros"} onClick={() => updateQuery({ tab: "cobros" })}>
          Cobros
        </TabButton>
      </div>

      {/* Filters */}
      <div className={`flex items-center gap-3 transition-opacity ${pending ? "opacity-70" : ""}`}>
        <input
          type="text"
          defaultValue={filterQ}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateQuery({ q: (e.target as HTMLInputElement).value });
          }}
          onBlur={(e) => {
            if (e.target.value !== filterQ) updateQuery({ q: e.target.value });
          }}
          placeholder="Buscar por dirección, inquilino, DNI o título…"
          className="h-11 flex-1 rounded-full border border-border bg-surface pl-4 pr-3 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "contratos" ? (
            contracts.length === 0 ? (
              <EmptyState onCreate={() => setWizardOpen(true)} />
            ) : (
              <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {contracts.map((c) => (
                    <ContractCard
                      key={c.id}
                      contract={c}
                      onOpenContract={() => setDetailContract(c)}
                      onOpenDue={(due) => openDue(c, due)}
                      onDelete={() => handleContractDelete(c)}
                      canDelete={isAdmin || c.createdByUser.id === currentUserId}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )
          ) : (
            <CobrosList
              headers={cobrosHeaders}
              loaded={loadedContracts}
              loadingIds={loadingContractIds}
              onExpand={loadContractDetail}
              onOpenDue={openDue}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      <ContractWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        properties={propertyList}
        tenants={tenantList}
        additionals={additionalsCatalog}
        onCreated={handleContractCreated}
        onTenantCreated={(t) => setTenantList((prev) => [t, ...prev])}
        onPropertyCreated={(p) => setPropertyList((prev) => [p, ...prev])}
      />

      <DueDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        due={activeDue}
        contractTitle={activeContract?.title ?? null}
        propertyAddress={activeContract?.property.address ?? ""}
        tenantName={activeContract?.tenant.fullName ?? ""}
        gracePeriodDays={activeContract?.gracePeriodDays ?? 0}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onUpdated={handleDueUpdated}
      />

      {/* Detalle de contrato (solo lectura) */}
      <ContractDetailModal
        contract={detailContract}
        onClose={() => setDetailContract(null)}
      />

      {/* Borrado seguro: hay que escribir ELIMINAR */}
      <Sheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar contrato"
        maxWidth="sm:max-w-sm"
        closeOnOverlay={false}
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-2 text-[13px] font-semibold text-text-faint hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleteConfirmText.trim() !== "ELIMINAR" || deleting}
              className="inline-flex h-11 items-center justify-center rounded-full bg-clay-chip px-5 text-[13.5px] font-bold text-terra transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Eliminando…" : "Eliminar contrato"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-text-muted">
            Vas a eliminar el contrato de <strong className="text-text">{deleteTarget?.tenant.fullName}</strong>.
            Se borran también <strong className="text-text">todas sus cuotas</strong>. Esta acción no se puede deshacer.
          </p>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
              Escribí <span className="font-bold text-terra">ELIMINAR</span> para confirmar
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              autoFocus
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function KPI({ label, value, hint, tone, surface }: { label: string; value: string; hint: string; tone: string; surface: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-[18px] px-4 py-3.5 ${surface}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{label}</p>
      <p className={`font-display text-xl font-bold leading-none md:text-2xl ${tone}`}>{value}</p>
      <p className="text-[11px] text-text-faint">{hint}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-full px-4 py-1.5 text-[12.5px] transition-colors ${
        active ? "font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
      }`}
    >
      {active && (
        <motion.span
          layoutId="rentals-tab"
          className="absolute inset-0 rounded-full bg-dark"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[11px] text-text-faint">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-semibold text-text">{children}</span>
    </div>
  );
}

function ContractDetailModal({
  contract,
  onClose,
}: {
  contract: SerializedContract | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={contract !== null}
      onClose={onClose}
      title="Detalle del contrato"
      description={contract ? contract.property.address : undefined}
      maxWidth="sm:max-w-lg"
      footer={
        <div className="flex w-full items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-[13px] font-semibold text-text-faint hover:text-text"
          >
            Cerrar
          </button>
        </div>
      }
    >
      {contract && (
        <div className="flex flex-col gap-4">
          {/* Inquilino */}
          <section className="rounded-[16px] bg-bg p-3">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Inquilino</h4>
            <p className="text-[14px] font-bold text-text">{contract.tenant.fullName}</p>
            <p className="mt-0.5 text-[11.5px] text-text-faint">
              {contract.tenant.idType.toUpperCase()} {contract.tenant.idNumber}
            </p>
            {(contract.tenant.phone || contract.tenant.email) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {contract.tenant.phone && (
                  <WhatsAppLink
                    phone={contract.tenant.phone}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sage-chip px-3 text-[12px] font-bold text-olive-light transition-opacity active:opacity-80"
                  >
                    {contract.tenant.phone}
                  </WhatsAppLink>
                )}
                {contract.tenant.email && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(contract.tenant.email!); toast.success("Mail copiado"); }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-text-muted active:bg-bg"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                    <span className="max-w-[160px] truncate">{contract.tenant.email}</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Contrato */}
          <section className="rounded-[16px] border border-border bg-surface px-3 py-1.5">
            <DetailRow label="Período">
              {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
            </DetailRow>
            <DetailRow label="Frecuencia">{RENTAL_FREQUENCY_LABEL[contract.frequency]}</DetailRow>
            <DetailRow label="Base">{formatARS(contract.baseAmount)} {contract.currency}</DetailRow>
            <DetailRow label="Primera cuota">{formatDate(contract.firstDueDate)}</DetailRow>
            <DetailRow label="Días de gracia">{contract.gracePeriodDays}</DetailRow>
          </section>

          {/* Adicionales */}
          {contract.additionals.length > 0 && (
            <section className="rounded-[16px] bg-bg p-3">
              <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Adicionales</h4>
              <div className="flex flex-col gap-1.5">
                {contract.additionals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="min-w-0 truncate text-text">{a.additional.name}</span>
                    <span className="shrink-0 font-display font-bold text-text-muted">{formatARS(a.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notas */}
          {contract.notes && (
            <section className="rounded-[16px] bg-bg p-3">
              <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Notas</h4>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">{contract.notes}</p>
            </section>
          )}

          <p className="text-[10.5px] text-text-faint">
            Creado por {contract.createdByUser.fullName ?? contract.createdByUser.email} · {formatRelative(contract.createdAt)}
          </p>
        </div>
      )}
    </Sheet>
  );
}

interface ContractCardProps {
  contract: SerializedContract;
  onOpenContract: () => void;
  onOpenDue: (due: SerializedDueDate) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function ContractCard({ contract, onOpenContract, onOpenDue, onDelete, canDelete }: ContractCardProps) {
  const summary = summarizeDueDates(contract.dueDates, contract.gracePeriodDays);
  const completion = summary.expectedTotal > 0 ? (summary.collectedTotal / summary.expectedTotal) * 100 : 0;
  const next = contract.dueDates.find((d) => {
    const eff = dueEffective(d, contract.gracePeriodDays);
    return eff === "esperando" || eff === "vencido" || eff === "parcial";
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-surface"
    >
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onOpenContract}
          className="group flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 font-display text-[15px] font-semibold text-text">{contract.property.address}</h3>
            {contract.title && <p className="text-[11px] text-text-muted">{contract.title}</p>}
            <p className="mt-0.5 truncate text-[11px] text-text-faint">
              {contract.tenant.fullName} · {contract.tenant.idType.toUpperCase()} {contract.tenant.idNumber}
            </p>
          </div>
          <svg className="mt-0.5 shrink-0 text-text-faint transition-colors group-hover:text-text" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar contrato"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted">
          <span>
            <span className="text-text-faint">Período: </span>
            {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
          </span>
          <span>
            <span className="text-text-faint">Frecuencia: </span>
            {RENTAL_FREQUENCY_LABEL[contract.frequency]}
          </span>
          <span>
            <span className="text-text-faint">Base: </span>
            <span className="font-display font-bold">{formatARS(contract.baseAmount)}</span>
          </span>
        </div>

        {/* Status counters */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(summary.counts) as RentalDueEffectiveStatus[])
            .filter((k) => summary.counts[k] > 0)
            .map((k) => (
              <span
                key={k}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${RENTAL_DUE_STATUS_STYLE[k].chip}`}
              >
                {RENTAL_DUE_STATUS_LABEL[k]} · {summary.counts[k]}
              </span>
            ))}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-text-muted">
              Cobrado {formatARS(summary.collectedTotal)} / {formatARS(summary.expectedTotal)}
            </span>
            <span className="font-display font-bold text-olive-light">{Math.round(completion)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <motion.div
              initial={false}
              animate={{ width: `${Math.min(100, completion)}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-olive-light"
            />
          </div>
        </div>

        {/* Next due quick action */}
        {next && (
          <button
            type="button"
            onClick={() => onOpenDue(next)}
            className="flex items-center justify-between rounded-[12px] bg-bg px-3 py-2.5 text-left transition-colors hover:bg-sand-chip"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Próxima cuota</p>
              <p className="truncate text-xs text-text">
                Cuota Nº {next.position} · {formatDate(next.dueDate)}
              </p>
            </div>
            <span className="font-display text-sm font-bold text-text">
              {formatARS(next.expectedAmount)}
            </span>
          </button>
        )}

        <p className="mt-auto text-[10px] text-text-faint">
          Actualizado {formatRelative(contract.updatedAt)}
        </p>
      </div>
    </motion.article>
  );
}

interface CobrosListProps {
  headers: CobrosContractHeader[];
  loaded: Record<string, SerializedContract>;
  loadingIds: Set<string>;
  onExpand: (id: string) => void;
  onOpenDue: (contract: SerializedContract, due: SerializedDueDate) => void;
}

function dueCollectedAmount(due: SerializedDueDate): number {
  return due.transactions.reduce((acc, t) => acc + t.amountPaid, 0);
}

function dueEffective(due: SerializedDueDate, gracePeriodDays: number): RentalDueEffectiveStatus {
  return getDueEffectiveStatus({
    dueDate: due.dueDate,
    status: due.status,
    gracePeriodDays,
    expectedAmount: due.expectedAmount,
    collected: dueCollectedAmount(due),
  });
}

function CobrosList({ headers, loaded, loadingIds, onExpand, onOpenDue }: CobrosListProps) {
  // Truly lazy: arrancan colapsados; al expandir se trae el detalle del contrato.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        onExpand(id);
      }
      return next;
    });
  }

  if (headers.length === 0) {
    return (
      <p className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
        No hay cuotas todavía. Creá un contrato para empezar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {headers.map((header) => {
        const summary = header.summary;
        const completion =
          summary.expectedTotal > 0
            ? Math.round((summary.collectedTotal / summary.expectedTotal) * 100)
            : 0;
        const isOpen = expanded.has(header.id);
        const contract = loaded[header.id];
        const isLoading = loadingIds.has(header.id);
        const dues = contract
          ? [...contract.dueDates].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          : [];

        return (
          <div key={header.id} className="overflow-hidden rounded-[18px] border border-border bg-surface">
            {/* Cabecera del contrato (toggle) */}
            <button
              type="button"
              onClick={() => toggle(header.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 text-text-faint transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[13.5px] font-bold text-text">{header.propertyAddress}</p>
                <p className="truncate text-[11.5px] text-text-faint">
                  {header.tenantName}
                  {header.title ? ` · ${header.title}` : ""}
                </p>
              </div>
              <div className="hidden flex-wrap items-center justify-end gap-1 lg:flex">
                {(Object.keys(summary.counts) as RentalDueEffectiveStatus[])
                  .filter((k) => summary.counts[k] > 0)
                  .map((k) => (
                    <span
                      key={k}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${RENTAL_DUE_STATUS_STYLE[k].chip}`}
                    >
                      {RENTAL_DUE_STATUS_LABEL[k]} · {summary.counts[k]}
                    </span>
                  ))}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-xs font-bold">
                  <span className="text-olive-light">{formatARS(summary.collectedTotal)}</span>
                  <span className="text-text-faint"> / {formatARS(summary.expectedTotal)}</span>
                </p>
                <p className="text-[10px] text-text-faint">{completion}% cobrado</p>
              </div>
            </button>

            {/* Cuotas del contrato (se cargan al expandir) */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-border"
                >
                  {!contract ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-text-muted">
                      {isLoading ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-olive-light border-t-transparent" />
                          Cargando cuotas…
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onExpand(header.id)}
                          className="rounded-full border border-border bg-surface px-3 py-1.5 font-semibold text-text-muted hover:bg-bg"
                        >
                          No se pudieron cargar. Reintentar
                        </button>
                      )}
                    </div>
                  ) : (
                  <>
                  {/* Mobile cards */}
                  <div className="flex flex-col divide-y divide-border sm:hidden">
                    {dues.map((due) => {
                      const collected = dueCollectedAmount(due);
                      const effective = dueEffective(due, contract.gracePeriodDays);
                      const style = RENTAL_DUE_STATUS_STYLE[effective];
                      return (
                        <button
                          key={due.id}
                          type="button"
                          onClick={() => onOpenDue(contract, due)}
                          className="flex flex-col gap-2 px-4 py-3 text-left transition-colors active:bg-bg"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-text">
                              {formatDate(due.dueDate)}
                              <span className="ml-1 text-[10px] font-medium text-text-faint">#{due.position}</span>
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${style.chip}`}>
                              {RENTAL_DUE_STATUS_LABEL[effective]}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] text-text-muted">
                              Esperado: <span className="font-display font-bold text-text">{formatARS(due.expectedAmount)}</span>
                            </span>
                            <span className="text-[11px] text-text-muted">
                              Cobrado: <span className="font-display font-bold text-olive-light">{formatARS(collected)}</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <table className="hidden w-full text-sm sm:table">
                    <thead className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                      <tr>
                        <th className="px-4 py-3 text-left">Vencimiento</th>
                        <th className="px-4 py-3 text-right">Esperado</th>
                        <th className="px-4 py-3 text-right">Cobrado</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dues.map((due) => {
                        const collected = dueCollectedAmount(due);
                        const effective = dueEffective(due, contract.gracePeriodDays);
                        const style = RENTAL_DUE_STATUS_STYLE[effective];
                        return (
                          <tr
                            key={due.id}
                            onClick={() => onOpenDue(contract, due)}
                            className="cursor-pointer transition-colors hover:bg-bg"
                          >
                            <td className="px-4 py-2.5 text-xs font-bold text-text">
                              {formatDate(due.dueDate)}
                              <span className="ml-1 text-[10px] font-medium text-text-faint">#{due.position}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-display text-xs font-bold text-text">
                              {formatARS(due.expectedAmount)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-display text-xs font-bold text-olive-light">
                              {formatARS(collected)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${style.chip}`}>
                                {RENTAL_DUE_STATUS_LABEL[effective]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-bg px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-chip">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <p className="font-display text-[15px] font-semibold text-text">Todavía no hay contratos</p>
      <p className="max-w-sm text-[12.5px] text-text-faint">
        Cargá tu primer contrato y se generan automáticamente las cuotas según la frecuencia.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
      >
        Crear el primero
      </button>
    </div>
  );
}
