"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { now, formatDate } from "@/lib/datetime";
import {
  formatMoney,
  monthKey,
  type AccountMovement,
  type AccountReport,
  type Currency,
  type EntryType,
} from "@/lib/account";
import { MovementFormModal } from "./movement-form-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import { MovementDetailModal } from "./movement-detail-modal";

export interface SerializedCategory {
  id: string;
  name: string;
  kind: EntryType;
  color: string | null;
  isSystem: boolean;
}

export interface SerializedAgent {
  id: string;
  name: string;
}

export interface AccountFilters {
  from: string;
  to: string;
  view: "rango" | "mensual";
  type?: EntryType;
  currency?: Currency;
  categoryId?: string;
  agentUserId?: string;
}

interface Props {
  report: AccountReport;
  categories: SerializedCategory[];
  agents: SerializedAgent[];
  filters: AccountFilters;
  isAdmin: boolean;
}

const selectClass =
  "rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none";

export function EstadosCuentaClient({ report, categories, agents, filters, isAdmin }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountMovement | null>(null);
  const [categorysOpen, setCategoriesOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewing, setViewing] = useState<AccountMovement | null>(null);
  const nowMs = Date.now();

  function openDetail(m: AccountMovement) {
    setViewing(m);
    setDetailOpen(true);
  }

  function apply(next: Partial<AccountFilters>) {
    const merged = { ...filters, ...next };
    const qs = new URLSearchParams();
    if (merged.from) qs.set("from", merged.from);
    if (merged.to) qs.set("to", merged.to);
    if (merged.view === "mensual") qs.set("view", "mensual");
    if (merged.type) qs.set("type", merged.type);
    if (merged.currency) qs.set("currency", merged.currency);
    if (merged.categoryId) qs.set("categoryId", merged.categoryId);
    if (merged.agentUserId) qs.set("agentUserId", merged.agentUserId);
    router.push(`${pathname}?${qs.toString()}`);
  }

  function applyPreset(preset: "mes" | "mesPasado" | "anio" | "todo") {
    const t = now();
    if (preset === "mes") apply({ from: t.startOf("month").toISODate()!, to: t.toISODate()! });
    else if (preset === "mesPasado") {
      const p = t.minus({ months: 1 });
      apply({ from: p.startOf("month").toISODate()!, to: p.endOf("month").toISODate()! });
    } else if (preset === "anio") apply({ from: t.startOf("year").toISODate()!, to: t.toISODate()! });
    else apply({ from: "2000-01-01", to: t.toISODate()! });
  }

  async function handleDelete(m: AccountMovement) {
    if (!confirm("¿Borrar este movimiento? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/estados-cuenta/movimientos/${m.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Movimiento borrado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  // Agrupar los movimientos del rango por mes (desc) para el modo "rango".
  const monthGroups = useMemo(() => {
    const map = new Map<string, AccountMovement[]>();
    for (const m of report.movements) {
      const k = monthKey(m.date);
      const arr = map.get(k);
      if (arr) arr.push(m);
      else map.set(k, [m]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [report.movements]);

  const incomeCategories = categories.filter((c) => c.kind === "income" && !c.isSystem);
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-text md:text-3xl">Estados de cuenta</h1>
          <p className="mt-1 text-sm text-text-muted">
            Caja de la inmobiliaria: ingresos (incluidas comisiones de alquiler) y egresos, por periodo y moneda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            Categorías
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo movimiento
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PresetButton onClick={() => applyPreset("mes")}>Este mes</PresetButton>
          <PresetButton onClick={() => applyPreset("mesPasado")}>Mes pasado</PresetButton>
          <PresetButton onClick={() => applyPreset("anio")}>Este año</PresetButton>
          <PresetButton onClick={() => applyPreset("todo")}>Todo</PresetButton>
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-bg p-1">
            <ViewTab active={filters.view === "rango"} onClick={() => apply({ view: "rango" })}>
              Rango
            </ViewTab>
            <ViewTab active={filters.view === "mensual"} onClick={() => apply({ view: "mensual" })}>
              Cierre mensual
            </ViewTab>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <input type="date" value={filters.from} onChange={(e) => apply({ from: e.target.value })} className={selectClass} />
          </Field>
          <Field label="Hasta">
            <input type="date" value={filters.to} onChange={(e) => apply({ to: e.target.value })} className={selectClass} />
          </Field>
          <Field label="Tipo">
            <select
              value={filters.type ?? ""}
              onChange={(e) => apply({ type: (e.target.value || undefined) as EntryType | undefined })}
              className={selectClass}
            >
              <option value="">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Egresos</option>
            </select>
          </Field>
          <Field label="Moneda">
            <select
              value={filters.currency ?? ""}
              onChange={(e) => apply({ currency: (e.target.value || undefined) as Currency | undefined })}
              className={selectClass}
            >
              <option value="">ARS y USD</option>
              <option value="ARS">Solo ARS</option>
              <option value="USD">Solo USD</option>
            </select>
          </Field>
          <Field label="Categoría">
            <select
              value={filters.categoryId ?? ""}
              onChange={(e) => apply({ categoryId: e.target.value || undefined })}
              className={selectClass}
            >
              <option value="">Todas</option>
              <optgroup label="Ingresos">
                {categories.filter((c) => c.kind === "income").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Egresos">
                {categories.filter((c) => c.kind === "expense").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Agente">
            <select
              value={filters.agentUserId ?? ""}
              onChange={(e) => apply({ agentUserId: e.target.value || undefined })}
              className={selectClass}
            >
              <option value="">Todos</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Resumen por moneda */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {report.byCurrency.map((cr) => (
          <div key={cr.currency} className="rounded-2xl border border-border bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Total en {cr.currency}</h2>
              <span className="rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-medium text-text-muted">{cr.currency}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Ingresos" value={formatMoney(cr.totalIncome, cr.currency)} tone="income" />
              <Stat label="Egresos" value={formatMoney(cr.totalExpense, cr.currency)} tone="expense" />
              <Stat label="Neto" value={formatMoney(cr.net, cr.currency)} tone={cr.net >= 0 ? "income" : "expense"} />
            </div>
            {filters.view === "mensual" && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-text-muted">
                  Saldo inicial: <span className="font-mono text-text">{formatMoney(cr.opening, cr.currency)}</span>
                </span>
                <span className="text-text-muted">
                  Saldo final:{" "}
                  <span className={`font-mono font-semibold ${cr.closing >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {formatMoney(cr.closing, cr.currency)}
                  </span>
                </span>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Contenido */}
      {report.movements.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center text-sm text-text-muted">
          No hay movimientos en el periodo seleccionado.
        </p>
      ) : filters.view === "mensual" ? (
        <section className="flex flex-col gap-6">
          {report.byCurrency
            .filter((cr) => cr.months.length > 0)
            .map((cr) => (
              <div key={cr.currency} className="overflow-hidden rounded-2xl border border-border">
                <div className="border-b border-border bg-bg/40 px-4 py-2.5 text-sm font-semibold text-text">
                  Cierre mensual · {cr.currency}
                </div>
                <div className="divide-y divide-border">
                  {[...cr.months].reverse().map((mb) => (
                    <MonthRow key={mb.month} bucket={mb} currency={cr.currency} onOpen={openDetail} />
                  ))}
                </div>
              </div>
            ))}
        </section>
      ) : (
        <section className="flex flex-col gap-5">
          {monthGroups.map(([key, items]) => (
            <div key={key} className="overflow-hidden rounded-2xl border border-border">
              <MonthGroupHeader monthKeyStr={key} items={items} />
              <div className="divide-y divide-border">
                {items.map((m) => (
                  <MovementRow key={m.id} m={m} onOpen={openDetail} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <MovementFormModal
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        agents={agents}
        defaultDate={filters.to}
      />

      <CategoryManagerModal
        open={categorysOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        isAdmin={isAdmin}
      />

      <MovementDetailModal
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) setViewing(null); }}
        movement={viewing}
        isAdmin={isAdmin}
        nowMs={nowMs}
        onEdit={(m) => { setEditing(m); setFormOpen(true); }}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function PresetButton({ onClick, children }: Readonly<{ onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
    >
      {children}
    </button>
  );
}

function ViewTab({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: Readonly<{ label: string; value: string; tone: "income" | "expense" }>) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone === "income" ? "text-emerald-300" : "text-red-300"}`}>
        {value}
      </p>
    </div>
  );
}

function MonthGroupHeader({ monthKeyStr, items }: Readonly<{ monthKeyStr: string; items: AccountMovement[] }>) {
  const byCurrency = useMemo(() => {
    const map = new Map<Currency, { income: number; expense: number }>();
    for (const m of items) {
      const cur = map.get(m.currency) ?? { income: 0, expense: 0 };
      if (m.type === "income") cur.income += m.amount;
      else cur.expense += m.amount;
      map.set(m.currency, cur);
    }
    return [...map.entries()];
  }, [items]);

  const [year, month] = monthKeyStr.split("-");
  const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const label = `${MONTHS[Number(month) - 1] ?? month} ${year}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg/40 px-4 py-2.5">
      <span className="text-sm font-semibold text-text">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {byCurrency.map(([cur, v]) => (
          <span key={cur} className="rounded-full bg-bg px-2.5 py-0.5 font-mono text-text-muted">
            {cur}: <span className="text-emerald-300">+{formatMoney(v.income, cur)}</span>{" "}
            <span className="text-red-300">−{formatMoney(v.expense, cur)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MovementRow({ m, onOpen }: Readonly<{ m: AccountMovement; onOpen: (m: AccountMovement) => void }>) {
  const isRental = m.source === "rental_commission";
  const attachmentCount = Array.isArray(m.attachments) ? m.attachments.length : 0;
  const meta = [
    formatDate(m.date),
    m.description,
    m.agentName,
    m.propertyAddress,
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg/30"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          m.type === "income" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
        }`}
      >
        {m.type === "income" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text">{m.categoryName ?? "Sin categoría"}</span>
          {isRental && (
            <span className="shrink-0 rounded-full bg-olive-deep px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
              Auto · alquiler
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-text-faint">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
              {attachmentCount}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">{meta}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className={`font-mono text-sm font-semibold ${m.type === "income" ? "text-emerald-300" : "text-red-300"}`}>
          {m.type === "income" ? "+" : "−"}
          {formatMoney(m.amount, m.currency)}
        </p>
      </div>
    </button>
  );
}

function MonthRow({
  bucket,
  currency,
  onOpen,
}: Readonly<{
  bucket: AccountReport["byCurrency"][number]["months"][number];
  currency: Currency;
  onOpen: (m: AccountMovement) => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg/30"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="w-32 shrink-0 text-sm font-medium text-text">{bucket.label}</span>
        <span className="hidden flex-1 items-center justify-end gap-4 font-mono text-xs sm:flex">
          <span className="text-text-muted">Inicial {formatMoney(bucket.opening, currency)}</span>
          <span className="text-emerald-300">+{formatMoney(bucket.income, currency)}</span>
          <span className="text-red-300">−{formatMoney(bucket.expense, currency)}</span>
        </span>
        <span className={`ml-auto shrink-0 font-mono text-sm font-semibold sm:ml-4 ${bucket.closing >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {formatMoney(bucket.closing, currency)}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border bg-bg/20">
          {bucket.movements.map((m) => (
            <MovementRow key={m.id} m={m} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
