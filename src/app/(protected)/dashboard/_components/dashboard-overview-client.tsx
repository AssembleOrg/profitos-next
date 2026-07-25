"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/datetime";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface DashboardOverview {
  scope: "admin" | "user";
  generatedAt: string;
  days: 1 | 7 | 30;
  kpis: {
    propertiesActive: number;
    propertiesNewPeriod: number;
    contactsNewPeriod: number;
    pendingPropertyFollowUps: number;
    pendingContactFollowUps: number;
    overduePropertyFollowUps: number;
  };
  lastProperties: Array<{
    id: string;
    address: string;
    city: string | null;
    type: string | null;
    status: string;
    operationType: string | null;
    operationPrice: number | null;
    operationCurrency: string | null;
    createdAt: string;
  }>;
  lastContacts: Array<{
    id: string;
    name: string;
    email: string | null;
    cellphone: string | null;
    phone: string | null;
    leadStatus: string | null;
    agentName: string | null;
    tokkoCreatedAt: string | null;
  }>;
  recentFollowUps: Array<{
    kind: "propiedad" | "consulta";
    id: string;
    title: string;
    status: string;
    responsible: string;
    updatedAt: string;
  }>;
  recentActions: Array<{
    kind: "propiedad" | "consulta";
    id: string;
    type: string;
    description: string;
    title: string;
    author: string;
    actionAt: string;
  }>;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try { return fmtDateTime(value); } catch { return "—"; }
}

function formatDateShort(value: string | null) {
  if (!value) return "—";
  try { return fmtDate(value); } catch { return "—"; }
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────
// 4 cards clicables. Mobile: carousel snap. Desktop: grid 4 cols.
// Cada card navega a la lista filtrada correspondiente.
function KpiStrip({
  kpis,
  selectedDays,
}: {
  kpis: DashboardOverview["kpis"];
  selectedDays: number;
}) {
  const totalPending = kpis.pendingPropertyFollowUps + kpis.pendingContactFollowUps;
  const isOverdue = kpis.overduePropertyFollowUps > 0;
  const isPendingZero = totalPending === 0;

  const periodLabel = selectedDays === 1 ? "hoy" : `${selectedDays}d`;

  const stats: {
    label: string;
    value: number | string;
    sub: string;
    variant: "default" | "red" | "green";
    href: string;
  }[] = [
    {
      label: "Propiedades",
      value: kpis.propertiesActive,
      sub: `+${kpis.propertiesNewPeriod} en ${periodLabel}`,
      variant: "default",
      href: "/propiedades?status=activa",
    },
    {
      label: "Consultas",
      value: kpis.contactsNewPeriod,
      sub: `nuevas en ${periodLabel}`,
      variant: "default",
      href: `/consultants`,
    },
    {
      label: "Pendientes",
      value: isPendingZero ? "✓" : totalPending,
      sub: isPendingZero ? "Al día" : "seguimientos",
      variant: isPendingZero ? "green" : "default",
      href: "/consultants-followups?status=pendiente",
    },
    {
      label: "Vencidos",
      value: isOverdue ? kpis.overduePropertyFollowUps : "✓",
      sub: isOverdue ? "requieren atención" : "Al día",
      variant: isOverdue ? "red" : "green",
      href: "/seguimientos",
    },
  ];

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autoplay — scroll directo en DOM
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = el.scrollWidth / stats.length;
      const nextIndex = (Math.round(el.scrollLeft / cardWidth) + 1) % stats.length;
      el.scrollTo({ left: nextIndex * cardWidth, behavior: "smooth" });
    }, 3000);
    return () => clearInterval(interval);
  }, [paused, stats.length]);

  function cardClasses(variant: "default" | "red" | "green", isActive: boolean, mobile: boolean) {
    const base = "flex flex-col rounded-2xl border p-3 transition-opacity";
    const opacity = mobile ? (isActive ? "opacity-100" : "opacity-60") : "";
    if (variant === "red") return `${base} border-danger/30 bg-danger-chip ${opacity}`;
    if (variant === "green") return `${base} border-secondary/30 bg-secondary/8 ${opacity}`;
    return `${base} border-border bg-surface/40 ${opacity}`;
  }

  function labelClasses(variant: "default" | "red" | "green") {
    if (variant === "red") return "text-[10px] font-medium uppercase tracking-widest text-danger";
    if (variant === "green") return "text-[10px] font-medium uppercase tracking-widest text-secondary";
    return "text-[10px] font-medium uppercase tracking-widest text-text-muted";
  }

  function valueClasses(variant: "default" | "red" | "green") {
    if (variant === "red") return "mt-1 text-3xl font-light tabular-nums text-danger";
    if (variant === "green") return "mt-1 text-3xl font-light tabular-nums text-secondary";
    return "mt-1 text-3xl font-light tabular-nums text-text";
  }

  function subClasses(variant: "default" | "red" | "green") {
    if (variant === "red") return "mt-0.5 text-[10px] text-danger";
    if (variant === "green") return "mt-0.5 text-[10px] text-secondary/60";
    return "mt-0.5 text-[10px] text-text-muted/60";
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop: grid 4 cols */}
      <div className="hidden gap-3 md:grid md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.04 }}
          >
            <Link href={s.href} className={`${cardClasses(s.variant, true, false)} block active:scale-[0.98]`}>
              <span className={labelClasses(s.variant)}>{s.label}</span>
              <span className={valueClasses(s.variant)}>{s.value}</span>
              <span className={subClasses(s.variant)}>{s.sub}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Mobile: carousel snap */}
      <div className="md:hidden">
        <div
          ref={scrollRef}
          className="-mx-5 flex gap-3 overflow-x-auto snap-x snap-mandatory px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const cardWidth = el.scrollWidth / stats.length;
            setActive(Math.round(el.scrollLeft / cardWidth));
          }}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.04 }}
              className="w-[calc(50vw-28px)] min-w-[110px] max-w-[160px] shrink-0 snap-center"
            >
              <Link href={s.href} className={`${cardClasses(s.variant, active === i, true)} block`}>
                <span className={labelClasses(s.variant)}>{s.label}</span>
                <span className={valueClasses(s.variant)}>{s.value}</span>
                <span className={subClasses(s.variant)}>{s.sub}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Dots */}
        <div className="mt-2 flex justify-center gap-1.5">
          {stats.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                const cardWidth = el.scrollWidth / stats.length;
                el.scrollTo({ left: i * cardWidth, behavior: "smooth" });
                setPaused(true);
                setTimeout(() => setPaused(false), 5000);
              }}
              className={`h-1 rounded-full transition-all duration-300 ${
                active === i ? "w-4 bg-secondary" : "w-1 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tabbed Feed ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "propiedades", label: "Propiedades", href: "/propiedades" },
  { key: "contactos", label: "Contactos", href: "/consultants" },
  { key: "seguimientos", label: "Seguimientos", href: "/consultants-followups" },
  { key: "acciones", label: "Acciones", href: "/consultants-followups" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function TabbedFeed({ data }: { data: DashboardOverview }) {
  const [active, setActive] = useState<TabKey>("propiedades");

  const rows: Record<TabKey, React.ReactNode[]> = {
    propiedades: data.lastProperties.map((item) => (
      <FeedRow
        key={item.id}
        primary={item.address}
        secondary={`${item.operationType ?? "Op."} · ${item.operationCurrency ?? ""} ${item.operationPrice?.toLocaleString("es-AR") ?? "s/d"}`}
        badge={item.status}
        badgeColor="olive"
      />
    )),
    contactos: data.lastContacts.map((item) => (
      <FeedRow
        key={item.id}
        primary={item.name}
        secondary={`${item.leadStatus ?? "Sin estado"} · ${item.agentName ?? "Sin agente"}`}
        badge={item.tokkoCreatedAt ? formatDateShort(item.tokkoCreatedAt) : undefined}
        badgeColor="neutral"
      />
    )),
    seguimientos: data.recentFollowUps.map((item) => (
      <FeedRow
        key={`${item.kind}-${item.id}`}
        primary={item.title}
        secondary={`${item.responsible}`}
        badge={item.status}
        badgeColor={item.status === "vencido" ? "red" : "olive"}
      />
    )),
    acciones: data.recentActions.map((item) => (
      <FeedRow
        key={`${item.kind}-${item.id}`}
        primary={item.title}
        secondary={`${item.type} · ${item.author}`}
        tertiary={item.description}
        badgeColor="neutral"
      />
    )),
  };

  const activeTab = TABS.find((t) => t.key === active)!;
  const items = rows[active];

  return (
    <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
      {/* Tab bar */}
      <div className="relative flex border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            whileTap={{ scale: 0.95 }}
            className={`relative flex-1 min-w-fit px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              active === tab.key ? "text-secondary" : "text-text-muted"
            }`}
          >
            {tab.label}
            {active === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary"
                transition={SPRING}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-muted">Sin datos</p>
          ) : (
            <div className="divide-y divide-border/50">
              {items}
            </div>
          )}
          <div className="flex justify-end border-t border-border/50 px-4 py-2.5">
            <Link
              href={activeTab.href}
              className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-text-muted transition-colors active:text-secondary"
            >
              <span>Ver todo</span>
              <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FeedRow({
  primary,
  secondary,
  tertiary,
  badge,
  badgeColor,
}: {
  primary: string;
  secondary: string;
  tertiary?: string;
  badge?: string;
  badgeColor: "olive" | "red" | "neutral";
}) {
  const badgeClass =
    badgeColor === "red"
      ? "bg-danger-chip text-danger"
      : badgeColor === "olive"
      ? "bg-secondary/10 text-secondary"
      : "bg-surface text-text-muted";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">{primary}</p>
        <p className="truncate text-xs text-text-muted">{secondary}</p>
        {tertiary && (
          <p className="truncate text-xs text-text-muted/60">{tertiary}</p>
        )}
      </div>
      {badge && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function DashboardOverviewClient() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<1 | 7 | 30>(7);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/overview?days=${selectedDays}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? "No se pudo cargar dashboard");
        if (mounted) setData(body.data as DashboardOverview);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "No se pudo cargar dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [selectedDays]);

  const scopeLabel = useMemo(() => {
    if (!data) return "";
    return data.scope === "admin" ? "Global" : "Personal";
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* KPI strip skeleton */}
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 w-[100px] shrink-0 animate-pulse rounded-2xl border border-border bg-surface/30" />
          ))}
        </div>
        {/* Feed skeleton */}
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface/30" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-surface/40 p-6">
        <p className="text-sm text-danger">{error ?? "No se pudo cargar dashboard"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {scopeLabel} · {formatDateTime(data.generatedAt)}
        </p>
        <div className="inline-flex items-center rounded-xl border border-border bg-bg/50 p-0.5">
          {([1, 7, 30] as const).map((days) => (
            <motion.button
              key={days}
              onClick={() => setSelectedDays(days)}
              whileTap={{ scale: 0.92 }}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDays === days ? "text-secondary" : "text-text-muted"
              }`}
            >
              {selectedDays === days && (
                <motion.div
                  layoutId="days-pill"
                  className="absolute inset-0 rounded-lg bg-secondary/15"
                  transition={SPRING}
                />
              )}
              <span className="relative">
                {days === 1 ? "Hoy" : `${days}d`}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* KPI horizontal scroll */}
      <KpiStrip
        kpis={data.kpis}
        selectedDays={selectedDays}
      />

      {/* Tabbed feed */}
      <TabbedFeed data={data} />
    </div>
  );
}
