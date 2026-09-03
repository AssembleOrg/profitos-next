"use client";

import Link from "next/link";
import { ExploreLink } from "./explore-link";
import { useEffect, useRef, useState } from "react";
import { useAccess } from "../../_components/access-context";
import { formatRelative } from "@/lib/datetime";
import { motion, AnimatePresence } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface DashboardOverview {
  scope: "admin" | "user";
  generatedAt: string;
  kpis: {
    propertiesActive: number;
    propertiesNewPeriod: number;
    pendingPropertyFollowUps: number;
    overduePropertyFollowUps: number;
    unansweredQuestions: number;
    questionsSyncedAt: string | null;
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
  recentFollowUps: Array<{
    kind: "propiedad";
    id: string;
    title: string;
    status: string;
    responsible: string;
    updatedAt: string;
  }>;
  recentActions: Array<{
    kind: "propiedad";
    id: string;
    type: string;
    description: string;
    title: string;
    author: string;
    actionAt: string;
  }>;
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────
// 4 cards clicables, misma altura. Mobile: carousel snap. Desktop: grid.
// Cada card navega a la lista filtrada correspondiente. Valor 0 → "✓ Al día".
type Variant = "default" | "red" | "green" | "amber";

interface Stat {
  label: string;
  value: number | string;
  sub: string;
  variant: Variant;
  href: string;
  icon: "home" | "alert" | "clock" | "chat";
}

const ICONS: Record<Stat["icon"], React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  alert: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  chat: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />,
};

function buildStats(kpis: DashboardOverview["kpis"]): Stat[] {
  const zero = (n: number) => n === 0;
  // La tabla local solo se actualiza por webhook o "Traer de ML": mostramos la edad de la data.
  const synced = kpis.questionsSyncedAt ? `sync ${formatRelative(kpis.questionsSyncedAt)}` : null;
  return [
    {
      label: "Propiedades",
      value: kpis.propertiesActive,
      sub: `+${kpis.propertiesNewPeriod} esta semana`,
      variant: "default",
      href: "/propiedades?status=activa",
      icon: "home",
    },
    {
      label: "Vencidos",
      value: zero(kpis.overduePropertyFollowUps) ? "✓" : kpis.overduePropertyFollowUps,
      sub: zero(kpis.overduePropertyFollowUps) ? "Al día" : "requieren atención",
      variant: zero(kpis.overduePropertyFollowUps) ? "green" : "red",
      href: "/seguimientos?vencidos=1",
      icon: "alert",
    },
    {
      label: "Pendientes",
      value: zero(kpis.pendingPropertyFollowUps) ? "✓" : kpis.pendingPropertyFollowUps,
      sub: zero(kpis.pendingPropertyFollowUps) ? "Al día" : "seguimientos",
      variant: zero(kpis.pendingPropertyFollowUps) ? "green" : "amber",
      href: "/seguimientos?status=pendiente",
      icon: "clock",
    },
    {
      label: "Preguntas ML",
      value: !synced ? "—" : zero(kpis.unansweredQuestions) ? "✓" : kpis.unansweredQuestions,
      sub: !synced ? "sin sincronizar" : zero(kpis.unansweredQuestions) ? synced : `sin responder · ${synced}`,
      variant: synced && zero(kpis.unansweredQuestions) ? "green" : "amber",
      href: "/preguntas?status=UNANSWERED",
      icon: "chat",
    },
  ];
}

const TINT: Record<Variant, string> = {
  default: "bg-sand-chip",
  red: "bg-clay-chip",
  green: "bg-sage-chip",
  amber: "bg-sand-chip",
};
const TONE: Record<Variant, string> = {
  default: "text-text",
  red: "text-terra",
  green: "text-olive-light",
  amber: "text-warning",
};

// Card 0 = hero dark; resto tintadas por variant. Mismo padding/tamaños en todas.
function KpiCard({ s, hero, dim }: { s: Stat; hero: boolean; dim?: boolean }) {
  const shell = hero
    ? "rounded-3xl bg-dark text-dark-fg"
    : `rounded-[18px] ${TINT[s.variant]}`;
  const label = hero ? "text-dark-muted" : "text-text-faint";
  const iconWrap = hero ? "bg-white/10 text-accent" : `bg-surface ${TONE[s.variant]}`;
  const value = hero ? "text-dark-fg" : TONE[s.variant];
  const sub = hero ? "text-accent" : s.variant === "default" ? "text-text-muted" : TONE[s.variant];
  return (
    <Link
      href={s.href}
      className={`flex h-full flex-col p-4 transition-opacity active:scale-[0.98] ${shell} ${dim ? "opacity-60" : "opacity-100"}`}
    >
      <span className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {ICONS[s.icon]}
          </svg>
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${label}`}>{s.label}</span>
      </span>
      <span className={`mt-1.5 font-display text-2xl font-bold tabular-nums md:text-3xl ${value}`}>{s.value}</span>
      <span className={`mt-1 truncate text-[10.5px] ${sub}`}>{s.sub}</span>
    </Link>
  );
}

function KpiStrip({ kpis }: { kpis: DashboardOverview["kpis"] }) {
  const { canAccess } = useAccess();
  const stats = buildStats(kpis).filter((s) => canAccess(s.href.split("?")[0]));

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

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop: grid, una columna por card (3 o 4 según acceso) */}
      <div
        className="hidden gap-3 md:grid"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="h-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.04 }}
          >
            <KpiCard s={s} hero={i === 0} />
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
              <KpiCard s={s} hero={i === 0} dim={active !== i} />
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
  { key: "seguimientos", label: "Seguimientos", href: "/seguimientos" },
  { key: "acciones", label: "Acciones", href: "/seguimientos" },
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
            <ExploreLink href={activeTab.href} />
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
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
  }, []);

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
    <div className="flex flex-col gap-3">
      <KpiStrip kpis={data.kpis} />

      {/* Tabbed feed */}
      <TabbedFeed data={data} />
    </div>
  );
}
