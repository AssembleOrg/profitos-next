"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDate, now } from "@/lib/datetime";
import { formatMoney, type AccountMovement, type Currency } from "@/lib/account";
import type { CashOverview, Money } from "@/lib/account/cash-server";
import { MovementFormModal } from "../../_components/movement-form-modal";
import { MovementDetailModal } from "../../_components/movement-detail-modal";
import { PendingList, type SerializedCategory } from "../../_components/estados-cuenta-client";
import { TransferSheet } from "./transfer-sheet";

interface Props {
  overview: CashOverview;
  categories: SerializedCategory[];
  currentUserId: string;
  isCostearOwner: boolean;
}

const CURRENCIES: Currency[] = ["ARS", "USD"];

function MoneyLines({ value, tone = "text-text", empty = "—" }: Readonly<{ value: Money; tone?: string; empty?: string }>) {
  const parts = CURRENCIES.filter((c) => value[c] !== 0);
  if (parts.length === 0) return <span className="font-display text-lg font-bold text-text-faint">{empty}</span>;
  return (
    <span className="flex flex-col">
      {parts.map((c) => (
        <span key={c} className={`font-display text-lg font-bold tabular-nums ${value[c] < 0 ? "text-terra" : tone}`}>
          {formatMoney(value[c], c)}
        </span>
      ))}
    </span>
  );
}

function moneyText(value: Money): string {
  const parts = CURRENCIES.filter((c) => value[c] !== 0).map((c) => formatMoney(value[c], c));
  return parts.length > 0 ? parts.join(" + ") : "—";
}

const hasMoney = (m: Money) => m.ARS !== 0 || m.USD !== 0;

export function CajaClient({ overview, categories, currentUserId, isCostearOwner }: Readonly<Props>) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountMovement | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [detail, setDetail] = useState<AccountMovement | null>(null);
  const [transferMode, setTransferMode] = useState<"transfer" | "adjust" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const nowMs = Date.now();
  const today = now().toISODate()!;

  const incomeCategories = categories.filter((c) => c.kind === "income" && !c.isSystem);
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const caja = overview.funds.find((f) => f.key === "caja");
  const cajaFree: Money = useMemo(() => {
    const base = caja?.balance ?? { ARS: 0, USD: 0 };
    return { ARS: base.ARS - overview.ownerPendingInCaja.ARS, USD: base.USD - overview.ownerPendingInCaja.USD };
  }, [caja, overview.ownerPendingInCaja]);

  function openSettle(m: AccountMovement) {
    setEditing(m);
    setCollecting(true);
    setFormOpen(true);
  }

  async function markOwnerPaid(ids: string[], undo = false) {
    setBusy(ids.join(","));
    try {
      const res = await fetch("/api/estados-cuenta/caja/rendir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: ids, undo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success(body?.message ?? "Listo");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }

  async function deleteMovement(m: AccountMovement) {
    if (!confirm("¿Borrar este pendiente? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/estados-cuenta/movimientos/${m.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Borrado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  async function deleteTransfer(id: string) {
    if (!confirm("¿Borrar este movimiento de caja? Los saldos se recalculan.")) return;
    try {
      const res = await fetch(`/api/estados-cuenta/caja/transferencias/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Movimiento borrado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/estados-cuenta" className="text-[12.5px] font-semibold text-text-faint hover:text-text">
            ← Estados de cuenta
          </Link>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-text md:text-[28px]">Caja y pendientes</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Dónde está la plata, qué falta cobrar y qué hay que pagar. La caja arrancó en 0: cuenta lo que se carga desde ahora.
          </p>
        </div>
        {overview.isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTransferMode("adjust")}
              className="inline-flex h-11 items-center rounded-full border border-border bg-surface px-4.5 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg"
            >
              Ajustar saldo
            </button>
            <button
              type="button"
              onClick={() => setTransferMode("transfer")}
              className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90"
            >
              Retiro / mover plata
            </button>
          </div>
        )}
      </header>

      {/* Bolsillos */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {overview.funds.map((f) => (
          <div
            key={f.key}
            className={`min-w-0 rounded-[20px] border p-4 ${
              f.key === "caja" ? "col-span-2 border-transparent bg-dark text-dark-fg" : "border-border bg-surface"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${f.key === "caja" ? "text-accent" : "text-text-faint"}`}>
              {f.fund === "persona" ? "Tiene" : f.label}
            </p>
            {f.fund === "persona" && <p className="truncate text-[14px] font-semibold text-text">{f.label}</p>}
            <div className="mt-1">
              {f.key === "caja" ? (
                <span className="flex flex-col">
                  {CURRENCIES.filter((c) => c === "ARS" || f.balance[c] !== 0).map((c) => (
                    <span key={c} className="font-display text-2xl font-bold tabular-nums">
                      {formatMoney(f.balance[c], c)}
                    </span>
                  ))}
                </span>
              ) : (
                <MoneyLines value={f.balance} empty="$ 0" />
              )}
            </div>
            {f.key === "caja" && hasMoney(overview.ownerPendingInCaja) && (
              <p className="mt-2 text-[12px] text-dark-fg/70">
                De esto, {moneyText(overview.ownerPendingInCaja)} es de propietarios sin retirar · de la inmobiliaria {moneyText(cajaFree)}
              </p>
            )}
            {f.fund === "persona" && (
              <p className="mt-1 text-[11px] leading-snug text-text-faint">Se llevó menos lo que pagó</p>
            )}
          </div>
        ))}
      </section>

      {/* Resumen de pendientes */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile label="A cobrar" value={overview.receivableTotal} tone="text-warning">
          {hasMoney(overview.receivableOverdue) && (
            <span className="text-terra">Vencido {moneyText(overview.receivableOverdue)}</span>
          )}
        </SummaryTile>
        <SummaryTile label="A pagar" value={overview.payableTotal} tone="text-terra" />
        <div className="col-span-2 sm:col-span-1">
          <SummaryTile label="Propietarios sin retirar" value={overview.ownerPendingTotal} tone="text-text" />
        </div>
      </section>

      {/* Propietarios sin retirar */}
      {overview.ownerPending.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg px-4 py-2.5">
            <span className="font-display text-sm font-semibold text-text">Alquileres que el propietario no retiró</span>
            <span className="text-[11px] text-text-muted">Al tocar «Retiró» sale de la caja</span>
          </div>
          <div className="divide-y divide-border">
            {overview.ownerPending.map((o) => (
              <div key={o.transactionId} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/alquileres/${o.contractId}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-text">
                    {o.ownerName ?? "Propietario"}
                    {o.fund === "banco" && <span className="ml-2 text-[10px] font-bold uppercase text-text-faint">banco</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-text-faint">
                    {[o.propertyAddress, o.unit].filter(Boolean).join(" ")} · cobrado {formatDate(o.paidAt)}
                    {o.tenantName ? ` · ${o.tenantName}` : ""}
                  </p>
                </Link>
                <span className="shrink-0 font-display text-sm font-bold tabular-nums text-text">{formatMoney(o.amount, o.currency)}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => markOwnerPaid([o.transactionId])}
                  className="inline-flex h-9 shrink-0 items-center rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Retiró
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <PendingList
        title="A cobrar"
        hint="Firmas, renovaciones y cuotas"
        items={overview.receivables}
        action="Cobrar"
        today={today}
        onSettle={openSettle}
        onOpen={setDetail}
      />
      <PendingList
        title="A pagar"
        hint="Colegas, agentes y cuotas"
        items={overview.payables}
        action="Pagar"
        today={today}
        onSettle={openSettle}
        onOpen={setDetail}
      />

      {/* Por persona */}
      {overview.counterparties.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-border bg-surface">
          <div className="border-b border-border bg-bg px-4 py-2.5">
            <span className="font-display text-sm font-semibold text-text">Por persona</span>
            <span className="ml-2 text-[11px] text-text-muted">Lo que se le debe y lo que cobró</span>
          </div>
          <div className="divide-y divide-border">
            {overview.counterparties.map((c) => (
              <div key={c.name} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 sm:items-center">
                <p className="col-span-2 truncate text-[13.5px] font-bold text-text sm:col-span-1">{c.name}</p>
                <Cell label="Se le debe" value={moneyText(c.pending)} tone={hasMoney(c.pending) ? "text-terra" : "text-text-faint"} />
                <Cell label="Cobró este mes" value={moneyText(c.paidThisMonth)} />
                <Cell label="Cobró el mes pasado" value={moneyText(c.paidLastMonth)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Retiros y ajustes (admin) */}
      {overview.isAdmin && overview.transfers.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-border bg-surface">
          <div className="border-b border-border bg-bg px-4 py-2.5 font-display text-sm font-semibold text-text">
            Retiros, movimientos y ajustes
          </div>
          <div className="divide-y divide-border">
            {overview.transfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-text">
                    {t.kind === "adjust" ? `Ajuste · ${t.toLabel}` : `${t.fromLabel} → ${t.toLabel}`}
                  </p>
                  <p className="truncate text-[11.5px] text-text-faint">
                    {formatDate(t.date)}
                    {t.description ? ` · ${t.description}` : ""}
                    {t.createdByName ? ` · ${t.createdByName}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 font-display text-sm font-bold tabular-nums ${t.kind === "adjust" && t.amount < 0 ? "text-terra" : "text-text"}`}>
                  {t.kind === "adjust" && t.amount > 0 ? "+" : ""}
                  {formatMoney(t.amount, t.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteTransfer(t.id)}
                  aria-label="Borrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-faint hover:bg-clay-chip hover:text-terra"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <MovementFormModal
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setEditing(null);
            setCollecting(false);
          }
        }}
        editing={editing}
        collecting={collecting}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        agents={overview.people}
        defaultDate={today}
        isCostearOwner={isCostearOwner}
        people={overview.people}
      />

      <MovementDetailModal
        open={detail !== null}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        movement={detail}
        isAdmin={overview.isAdmin}
        nowMs={nowMs}
        onEdit={(m) => {
          setEditing(m);
          setCollecting(false);
          setFormOpen(true);
        }}
        onDelete={deleteMovement}
      />

      <TransferSheet
        mode={transferMode}
        onClose={() => setTransferMode(null)}
        funds={overview.funds}
        people={overview.people}
        currentUserId={currentUserId}
        today={today}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  children,
}: Readonly<{ label: string; value: Money; tone: string; children?: React.ReactNode }>) {
  return (
    <div className="h-full min-w-0 rounded-[20px] border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{label}</p>
      <div className="mt-1">
        <MoneyLines value={value} tone={tone} empty="$ 0" />
      </div>
      {children && <p className="mt-1 text-[11.5px]">{children}</p>}
    </div>
  );
}

function Cell({ label, value, tone = "text-text" }: Readonly<{ label: string; value: string; tone?: string }>) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-text-faint sm:hidden">{label}</p>
      <p className={`truncate font-display text-[13px] font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="hidden text-[10px] text-text-faint sm:block">{label}</p>
    </div>
  );
}
