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

  // V4: card 0 = hero dark, cards 1-3 = tintadas (sand / sage / clay)
  function cardClasses(variant: "default" | "red" | "green", isActive: boolean, mobile: boolean, index: number) {
    const opacity = mobile ? (isActive ? "opacity-100" : "opacity-60") : "";
    if (index === 0) return `flex flex-col rounded-3xl bg-dark p-4 text-dark-fg transition-opacity md:p-5 ${opacity}`;
    const tint =
      index === 1
        ? "bg-sand-chip"
        : index === 2
          ? "bg-sage-chip"
          : variant === "red"
            ? "bg-clay-chip"
            : "bg-sage-chip";
    return `flex flex-col rounded-[18px] ${tint} p-4 transition-opacity ${opacity}`;
  }

  function labelClasses(variant: "default" | "red" | "green", index: number) {
    if (index === 0) return "text-[10px] font-bold uppercase tracking-[0.12em] text-dark-muted";
    return "text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint";
  }

  function valueClasses(variant: "default" | "red" | "green", index: number) {
    if (index === 0) return "mt-2 font-display text-3xl font-bold tabular-nums text-dark-fg md:text-4xl";
    const tone = variant === "red" ? "text-terra" : variant === "green" ? "text-olive-light" : "text-text";
    return `mt-1.5 font-display text-2xl font-bold tabular-nums ${tone}`;
  }

  function subClasses(variant: "default" | "red" | "green", index: number) {
    if (index === 0) return "mt-2 inline-flex w-fit items-center rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent";
    const tone = variant === "red" ? "text-terra" : variant === "green" ? "text-olive-light" : "text-text-muted";
    return `mt-1 text-[10.5px] ${tone}`;
  }

  function kpiIcon(variant: "default" | "red" | "green", index: number) {
    if (index === 0) return null;
    const tone = index === 1 ? "text-warning" : index === 3 && variant === "red" ? "text-terra" : "text-olive-light";
    const common = {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
    return (
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface ${tone}`}>
        {index === 1 && (
          <svg {...common}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        )}
        {index === 2 && (
          <svg {...common}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )}
        {index === 3 && (
          <svg {...common}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </span>
    );
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
            <Link href={s.href} className={`${cardClasses(s.variant, true, false, i)} block active:scale-[0.98]`}>
              {i === 0 ? (
                <span className={labelClasses(s.variant, i)}>{s.label}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {kpiIcon(s.variant, i)}
                  <span className={labelClasses(s.variant, i)}>{s.label}</span>
                </span>
              )}
              <span className={valueClasses(s.variant, i)}>{s.value}</span>
              <span className={subClasses(s.variant, i)}>{s.sub}</span>
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
              <Link href={s.href} className={`${cardClasses(s.variant, active === i, true, i)} block`}>
                {i === 0 ? (
                  <span className={labelClasses(s.variant, i)}>{s.label}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    {kpiIcon(s.variant, i)}
                    <span className={labelClasses(s.variant, i)}>{s.label}</span>
                  </span>
                )}
                <span className={valueClasses(s.variant, i)}>{s.value}</span>
                <span className={subClasses(s.variant, i)}>{s.sub}</span>
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
                active === i ? "w-4 bg-dark" : "w-1 bg-border"
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
    <div className="rounded-[20px] border border-border bg-surface overflow-hidden">
      {/* Tab bar — sub-tabs suaves V4 */}
      <div className="relative mx-3 mt-3 flex w-fit max-w-full gap-0.5 rounded-full bg-bg p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            whileTap={{ scale: 0.95 }}
            className={`relative shrink-0 rounded-full px-4 py-2 text-[12.5px] whitespace-nowrap transition-colors ${
              active === tab.key ? "font-bold text-text" : "font-medium text-text-faint hover:text-text"
            }`}
          >
            {active === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
                transition={SPRING}
              />
            )}
            <span className="relative">{tab.label}</span>
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
            <p className="px-5 py-8 text-center text-[12.5px] text-text-faint">Sin datos</p>
          ) : (
            <div className="divide-y divide-border/50">
              {items}
            </div>
          )}
          <div className="flex justify-end border-t border-border/50 px-4 py-2.5">
            <Link
              href={activeTab.href}
              className="group flex items-center gap-1.5 text-[12.5px] font-bold text-terra transition-opacity active:opacity-80"
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
      ? "bg-clay-chip text-terra"
      : badgeColor === "olive"
      ? "bg-sage-chip text-olive-light"
      : "bg-bg text-text-faint";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-text">{primary}</p>
        <p className="truncate text-[11.5px] text-text-faint">{secondary}</p>
        {tertiary && (
          <p className="truncate text-[11.5px] text-text-faint/70">{tertiary}</p>
        )}
      </div>
      {badge && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}>
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
            <div key={i} className="h-20 w-[100px] shrink-0 animate-pulse rounded-[18px] border border-border bg-surface" />
          ))}
        </div>
        {/* Feed skeleton */}
        <div className="h-64 animate-pulse rounded-[20px] border border-border bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[20px] border border-border bg-surface p-6">
        <p className="text-sm text-danger">{error ?? "No se pudo cargar dashboard"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-text-faint">
          {scopeLabel} · {formatDateTime(data.generatedAt)}
        </p>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1">
          {([1, 7, 30] as const).map((days) => (
            <motion.button
              key={days}
              onClick={() => setSelectedDays(days)}
              whileTap={{ scale: 0.92 }}
              className={`relative rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
                selectedDays === days ? "font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              {selectedDays === days && (
                <motion.div
                  layoutId="days-pill"
                  className="absolute inset-0 rounded-full bg-dark"
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
