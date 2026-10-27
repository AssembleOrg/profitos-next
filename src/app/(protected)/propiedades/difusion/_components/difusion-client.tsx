"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatRelative } from "@/lib/datetime";
import { PLAN_LABEL, PORTAL_LABEL, STATUS_LABEL, hasAlert, hasError } from "@/lib/publish/difusion-parse";
import type { DifusionListing, DifusionPortal, DifusionUnlisted } from "@/lib/publish/difusion-view";

type View = "errores" | "alertas" | "sugerencias" | "publicados" | "sin-aviso";

interface Props {
  portals: DifusionPortal[];
  listings: DifusionListing[];
  unlisted: DifusionUnlisted[];
}

const VIEWS: { key: View; label: string }[] = [
  { key: "errores", label: "Con errores" },
  { key: "alertas", label: "Con alertas" },
  { key: "sugerencias", label: "Sugerencias" },
  { key: "publicados", label: "Publicados" },
  { key: "sin-aviso", label: "Sin aviso" },
];

const ML_PLAN_LABEL: Record<string, string> = { premium: "Premium", clasica: "Clásica", gratuita: "Gratuita" };

function planLabel(plan: string | null): string | null {
  if (!plan) return null;
  return PLAN_LABEL[plan] ?? ML_PLAN_LABEL[plan] ?? plan;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function DifusionClient({ portals, listings, unlisted }: Readonly<Props>) {
  const router = useRouter();
  const totalErrores = portals.reduce((a, p) => a + p.summary.errores, 0);
  const [portal, setPortal] = useState<string>("todos");
  const [view, setView] = useState<View>(totalErrores > 0 ? "errores" : "alertas");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    const t = toast.loading("Revisando los avisos en ZonaProp y ArgenProp… puede tardar un par de minutos");
    try {
      const res = await fetch("/api/integrations/portales/difusion", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.refreshed) toast.success(body.message ?? "Difusión actualizada", { id: t });
      else toast.error(body.message ?? "No se pudo actualizar", { id: t });
      router.refresh();
    } catch {
      toast.error("Error de conexión al actualizar", { id: t });
    } finally {
      setRefreshing(false);
    }
  }

  function pick(p: string, v: View) {
    setPortal(p);
    setView(v);
    document.getElementById("difusion-lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));

  const filtered = useMemo(() => {
    return listings
      .filter((l) => portal === "todos" || l.portal === portal)
      .filter((l) => {
        if (view === "errores") return hasError(l);
        if (view === "alertas") return l.published && !hasError(l) && hasAlert(l);
        if (view === "sugerencias") return l.published && !hasError(l) && !hasAlert(l) && l.issues.length > 0;
        if (view === "publicados") return l.published;
        return false;
      })
      .filter((l) => matches(l.address, l.code, l.title, l.property?.address, l.externalId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, portal, view, q]);

  const filteredUnlisted = useMemo(
    () =>
      unlisted
        .filter((u) => portal === "todos" || u.missing.includes(portal))
        .filter((u) => matches(u.address, u.referenceCode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unlisted, portal, q],
  );

  // "Avisos duplicados: 600…,599…" → direcciones (ZP sólo da los ids).
  const addressById = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of listings) m.set(`${l.portal}:${l.externalId}`, l.property?.address ?? l.address ?? l.externalId);
    return m;
  }, [listings]);

  const count = view === "sin-aviso" ? filteredUnlisted.length : filtered.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Difusión</h1>
          <p className="text-sm text-text-muted">Cómo están tus avisos en cada portal: qué salió, qué tiene errores y qué conviene revisar.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={refreshing ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* Portales */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {portals.map((p) => (
          <PortalCard key={p.portal} p={p} onPick={pick} />
        ))}
      </div>

      {/* Filtros */}
      <div id="difusion-lista" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={portal}
              onChange={setPortal}
              options={[{ key: "todos", label: "Todos" }, ...portals.map((p) => ({ key: p.portal, label: PORTAL_LABEL[p.portal] ?? p.portal }))]}
            />
            <Segmented value={view} onChange={(v) => setView(v as View)} options={VIEWS} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dirección o código"
            className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none lg:w-72"
          />
        </div>
        <p className="text-sm text-text-muted">
          {view === "sin-aviso"
            ? `${plural(count, "propiedad publicada", "propiedades publicadas")} en otro portal pero sin aviso${portal === "todos" ? " en alguno" : ` en ${PORTAL_LABEL[portal]}`}`
            : plural(count, "aviso", "avisos")}
        </p>
      </div>

      {/* Lista */}
      {view === "sin-aviso" ? (
        <UnlistedList items={filteredUnlisted} />
      ) : filtered.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-surface px-5 py-10 text-center text-sm text-text-muted">
          {view === "errores" ? "No hay avisos con errores." : view === "alertas" ? "No hay avisos con alertas." : view === "sugerencias" ? "No hay sugerencias pendientes." : "No hay avisos para mostrar."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.slice(0, 300).map((l) => (
            <ListingRow key={`${l.portal}:${l.id}`} l={l} showPortal={portal === "todos"} addressById={addressById} />
          ))}
          {filtered.length > 300 && <li className="px-2 text-xs text-text-faint">Se muestran los primeros 300. Usá el buscador para encontrar el resto.</li>}
        </ul>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { key: string; label: string }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.key ? "bg-dark font-bold text-dark-fg" : "text-text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PortalCard({ p, onPick }: { p: DifusionPortal; onPick: (portal: string, view: View) => void }) {
  const s = p.summary;
  const plans = Object.entries(s.porPlan)
    .sort((a, b) => b[1] - a[1])
    .map(([plan, n]) => `${n} ${(planLabel(plan) ?? plan).toLowerCase()}`)
    .join(" · ");
  const duplicados = typeof p.portalTotals?.totalDuplicatedPosting === "number" ? (p.portalTotals.totalDuplicatedPosting as number) : null;
  const denuncias = typeof p.portalTotals?.totalReport === "number" ? (p.portalTotals.totalReport as number) : null;
  const neverSynced = p.portal !== "mercadolibre" && !p.syncedAt;

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-text">{PORTAL_LABEL[p.portal] ?? p.portal}</h2>
        <span className="text-[11.5px] text-text-faint">
          {p.portal === "mercadolibre" ? "en vivo" : p.syncedAt ? `actualizado ${formatRelative(p.syncedAt)}` : "sin datos todavía"}
        </span>
      </header>

      {!p.ok && p.error && (
        <p className="rounded-xl bg-clay-chip px-3 py-2 text-xs text-terra">
          No se pudo actualizar: {p.error.slice(0, 160)}
          {p.syncedAt ? " — se muestran los datos anteriores." : ""}
        </p>
      )}

      {neverSynced ? (
        <p className="text-sm text-text-muted">Todavía no se revisó este portal. Tocá “Actualizar” o esperá la próxima pasada (cada 2 horas).</p>
      ) : (
        <>
          <button onClick={() => onPick(p.portal, "publicados")} className="flex flex-col items-start text-left">
            <span className="font-display text-3xl font-bold tabular-nums text-text">{s.publicadas}</span>
            <span className="text-xs text-text-muted">publicados{plans ? ` · ${plans}` : ""}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onPick(p.portal, "errores")}
              className={`flex flex-col items-start rounded-xl px-3 py-2 text-left transition-opacity active:scale-[0.98] ${s.errores ? "bg-clay-chip" : "bg-bg"}`}
            >
              <span className={`font-display text-xl font-bold tabular-nums ${s.errores ? "text-terra" : "text-text-faint"}`}>{s.errores}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">Errores</span>
            </button>
            <button
              onClick={() => onPick(p.portal, "alertas")}
              className={`flex flex-col items-start rounded-xl px-3 py-2 text-left transition-opacity active:scale-[0.98] ${s.alertas ? "bg-sand-chip" : "bg-bg"}`}
            >
              <span className={`font-display text-xl font-bold tabular-nums ${s.alertas ? "text-warning" : "text-text-faint"}`}>{s.alertas}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">Alertas</span>
            </button>
          </div>

          <ul className="flex flex-col gap-1 text-xs text-text-muted">
            {s.calidadPromedio !== null && <li>Calidad promedio de los avisos: <b className="text-text">{s.calidadPromedio}%</b></li>}
            {s.sugerencias > 0 && (
              <li>
                <button onClick={() => onPick(p.portal, "sugerencias")} className="underline decoration-border-strong underline-offset-2 hover:text-text">
                  {plural(s.sugerencias, "aviso", "avisos")} con sugerencias para mejorar
                </button>
              </li>
            )}
            {duplicados !== null && duplicados > 0 && <li>El portal detecta <b className="text-terra">{plural(duplicados, "aviso duplicado", "avisos duplicados")}</b></li>}
            {denuncias !== null && denuncias > 0 && <li><b className="text-terra">{plural(denuncias, "denuncia", "denuncias")}</b> de usuarios</li>}
            {p.portal === "argenprop" && <li>ArgenProp no informa calidad ni alertas por aviso.</li>}
            <li>
              <button onClick={() => onPick(p.portal, "sin-aviso")} className="underline decoration-border-strong underline-offset-2 hover:text-text">
                {plural(p.sinAviso, "propiedad", "propiedades")} publicada{p.sinAviso === 1 ? "" : "s"} en otro portal y acá no
              </button>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

function StatusChip({ l }: { l: DifusionListing }) {
  const err = hasError(l);
  const tone = err ? "bg-clay-chip text-terra" : l.published ? "bg-sage-chip text-success" : "bg-sand-chip text-warning";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{STATUS_LABEL[l.status] ?? l.status.toLowerCase()}</span>;
}

function QualityBar({ value }: { value: number }) {
  const tone = value >= 90 ? "bg-olive-light" : value >= 70 ? "bg-warning" : "bg-terra";
  return (
    <span className="flex items-center gap-2" title={`Calidad del aviso según el portal: ${value}%`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(3, value)}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-text-muted">{value}%</span>
    </span>
  );
}

function readableMessage(l: DifusionListing, message: string, addressById: Map<string, string>): string {
  return message.replace(/Avisos duplicados:\s*([\d,\s]+)\.?/, (_, ids: string) => {
    const list = ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => addressById.get(`${l.portal}:${id}`) ?? `aviso ${id}`);
    return `Se repite con: ${[...new Set(list)].join(" · ")}.`;
  });
}

function ListingRow({ l, showPortal, addressById }: { l: DifusionListing; showPortal: boolean; addressById: Map<string, string> }) {
  const plan = planLabel(l.plan);
  const address = l.property?.address ?? l.address ?? l.title ?? `Aviso ${l.externalId}`;
  return (
    <li className="flex gap-3 rounded-[18px] border border-border bg-surface p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg">
        {l.pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.pictureUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-bold text-text">{address}</span>
          {l.code && <span className="text-[11.5px] text-text-faint">{l.code}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showPortal && <span className="text-[11.5px] font-semibold text-text-muted">{PORTAL_LABEL[l.portal] ?? l.portal}</span>}
          <StatusChip l={l} />
          {plan && <span className="text-[11.5px] text-text-muted">{plan}</span>}
          {l.quality !== null && <QualityBar value={l.quality} />}
        </div>
        {l.issues.length > 0 && (
          <ul className="flex flex-col gap-1">
            {l.issues.map((i, n) => (
              <li key={n} className="flex gap-2 text-xs leading-snug">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${i.level === "error" ? "bg-terra" : i.level === "warn" ? "bg-warning" : "bg-border-strong"}`} />
                <span className={i.level === "error" ? "text-text" : "text-text-muted"}>{readableMessage(l, i.message, addressById)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" className="text-info hover:underline">
              Ver en {PORTAL_LABEL[l.portal] ?? "el portal"} ↗
            </a>
          )}
          {l.property ? (
            <Link href={`/propiedades?q=${encodeURIComponent(l.property.address)}`} prefetch={false} className="text-text-muted hover:text-text hover:underline">
              Ver propiedad
            </Link>
          ) : (
            <span className="font-normal text-text-faint">No vinculado a una propiedad del sistema</span>
          )}
        </div>
      </div>
    </li>
  );
}

function UnlistedList({ items }: { items: DifusionUnlisted[] }) {
  if (!items.length) {
    return <div className="rounded-[18px] border border-border bg-surface px-5 py-10 text-center text-sm text-text-muted">No hay propiedades con avisos faltantes.</div>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.slice(0, 300).map((u) => (
        <li key={u.id} className="flex flex-col gap-1 rounded-[18px] border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href={`/propiedades?q=${encodeURIComponent(u.address)}`} prefetch={false} className="truncate text-sm font-bold text-text hover:underline">
              {u.address}
            </Link>
            {u.referenceCode && <span className="ml-2 text-[11.5px] text-text-faint">{u.referenceCode}</span>}
          </div>
          <span className="text-xs text-text-muted">Sin aviso en {u.missing.map((m) => PORTAL_LABEL[m] ?? m).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}
