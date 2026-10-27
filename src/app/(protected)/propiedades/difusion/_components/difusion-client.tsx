"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatRelative } from "@/lib/datetime";
import { Sheet } from "../../../_components/sheet";
import { SelectField } from "@/components/ui/select-field";
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

/** Ficha de la propiedad: Propiedades filtrado por código (único) y el modal abierto (?open=). */
function fichaHref(p: { id: string; address: string; referenceCode?: string | null }): string {
  return `/propiedades?q=${encodeURIComponent(p.referenceCode || p.address)}&open=${encodeURIComponent(p.id)}`;
}

/** Minúsculas y sin tildes: "colon" encuentra "Colón". */
function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Todas las palabras de la búsqueda tienen que aparecer ("lavalle 704"). */
function matchesQuery(q: string, ...fields: (string | null | undefined)[]): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

/** Valor que se actualiza 300 ms después de la última tecla. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Tipos de problema para el filtro (agrupa reglas parecidas de cada portal). */
const PROBLEM_GROUPS: { key: string; label: string; rules: string[] }[] = [
  { key: "duplicado", label: "Duplicado", rules: ["duplicate"] },
  { key: "emprendimiento", label: "Emprendimiento publicado como clasificado", rules: ["deployment"] },
  { key: "sin-cupo", label: "Sin cupo / no se publicó", rules: ["without_credit", "publish_error", "not_published"] },
  { key: "cerrado", label: "Cerrado desde afuera", rules: ["external_change"] },
  { key: "vendido", label: "Figura vendido o alquilado", rules: ["rented_or_sold"] },
  { key: "precio", label: "Precio", rules: ["price"] },
  { key: "fotos", label: "Fotos", rules: ["pictures_quality", "pictures_quality_ground", "no_pictures"] },
  { key: "caracteristicas", label: "Faltan características", rules: ["housing_feature", "office_feature"] },
  { key: "ubicacion", label: "Ubicación incompleta", rules: ["location_quality", "location_quality_ground"] },
  { key: "superficie", label: "Superficie", rules: ["area"] },
  { key: "descripcion", label: "Descripción", rules: ["description"] },
  { key: "vence", label: "Por vencer", rules: ["near_end"] },
  { key: "revision", label: "En revisión", rules: ["under_review"] },
];

function problemOf(rule: string): string {
  return PROBLEM_GROUPS.find((g) => g.rules.includes(rule))?.key ?? "otro";
}

function filterListings(listings: DifusionListing[], portal: string, view: View, q: string, problem = ""): DifusionListing[] {
  return listings
    .filter((l) => portal === "todos" || l.portal === portal)
    .filter((l) => {
      if (view === "errores") return hasError(l);
      if (view === "alertas") return l.published && !hasError(l) && hasAlert(l);
      if (view === "sugerencias") return l.published && !hasError(l) && !hasAlert(l) && l.issues.length > 0;
      if (view === "publicados") return l.published;
      return false;
    })
    .filter((l) => !problem || l.issues.some((i) => problemOf(i.rule) === problem))
    .filter((l) => matchesQuery(q, l.address, l.code, l.title, l.property?.address, l.property?.referenceCode, l.externalId));
}

/** Opciones del filtro de problema según lo que hay en la lista (con cantidad). */
function problemOptions(listings: DifusionListing[]): { key: string; label: string; n: number }[] {
  const n = new Map<string, number>();
  for (const l of listings) for (const k of new Set(l.issues.map((i) => problemOf(i.rule)))) n.set(k, (n.get(k) ?? 0) + 1);
  return [...PROBLEM_GROUPS, { key: "otro", label: "Otro", rules: [] }]
    .filter((g) => n.has(g.key))
    .map((g) => ({ key: g.key, label: g.label, n: n.get(g.key)! }));
}

function ProblemFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { key: string; label: string; n: number }[] }) {
  if (!options.length) return null;
  return (
    <SelectField value={value} onChange={(e) => onChange(e.target.value)} wrapperClassName="w-full sm:w-64" aria-label="Tipo de problema">
      <option value="">Todos los problemas</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label} ({o.n})
        </option>
      ))}
    </SelectField>
  );
}

function filterUnlisted(unlisted: DifusionUnlisted[], portal: string, q: string): DifusionUnlisted[] {
  return unlisted
    .filter((u) => portal === "todos" || u.missing.includes(portal))
    .filter((u) => matchesQuery(q, u.address, u.referenceCode));
}

const VIEW_TITLE: Record<View, string> = {
  errores: "Avisos con errores",
  alertas: "Avisos con alertas",
  sugerencias: "Avisos con sugerencias",
  publicados: "Avisos publicados",
  "sin-aviso": "Propiedades sin aviso",
};

export function DifusionClient({ portals, listings, unlisted }: Readonly<Props>) {
  const router = useRouter();
  const totalErrores = portals.reduce((a, p) => a + p.summary.errores, 0);
  const [portal, setPortal] = useState<string>("todos");
  const [view, setView] = useState<View>(totalErrores > 0 ? "errores" : "alertas");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Modal que abren los números de cada portal (errores, alertas, publicados…).
  const [modal, setModal] = useState<{ portal: string; view: View } | null>(null);

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
    setModal({ portal: p, view: v });
  }

  const [problem, setProblem] = useState("");
  const q = useDebounced(query.trim());
  const base = useMemo(() => filterListings(listings, portal, view, ""), [listings, portal, view]);
  const problems = useMemo(() => problemOptions(base), [base]);
  // Si se cambia de vista y ese problema ya no está, el filtro se ignora.
  const activeProblem = problems.some((o) => o.key === problem) ? problem : "";
  const filtered = useMemo(() => filterListings(listings, portal, view, q, activeProblem), [listings, portal, view, q, activeProblem]);
  const filteredUnlisted = useMemo(() => filterUnlisted(unlisted, portal, q), [unlisted, portal, q]);

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
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Buscar por dirección, título o código"
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none lg:w-72"
            />
            {view !== "sin-aviso" && <ProblemFilter value={activeProblem} onChange={setProblem} options={problems} />}
          </div>
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

      {modal && (
        <DifusionModal
          modal={modal}
          onChange={setModal}
          onClose={() => setModal(null)}
          portals={portals}
          listings={listings}
          unlisted={unlisted}
          addressById={addressById}
        />
      )}
    </div>
  );
}

/**
 * Modal de un número del panel (errores, alertas, publicados…): lista compacta;
 * cada aviso se despliega con el detalle y lleva a la ficha de la propiedad.
 * Arriba se puede cambiar de portal y de vista sin cerrarlo.
 */
function DifusionModal({
  modal,
  onChange,
  onClose,
  portals,
  listings,
  unlisted,
  addressById,
}: {
  modal: { portal: string; view: View };
  onChange: (m: { portal: string; view: View }) => void;
  onClose: () => void;
  portals: DifusionPortal[];
  listings: DifusionListing[];
  unlisted: DifusionUnlisted[];
  addressById: Map<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(query.trim());
  const base = useMemo(() => filterListings(listings, modal.portal, modal.view, ""), [listings, modal]);
  const problems = useMemo(() => problemOptions(base), [base]);
  const activeProblem = problems.some((o) => o.key === problem) ? problem : "";
  const items = useMemo(() => filterListings(listings, modal.portal, modal.view, q, activeProblem), [listings, modal, q, activeProblem]);
  const props = useMemo(() => filterUnlisted(unlisted, modal.portal, q), [unlisted, modal, q]);
  const isUnlisted = modal.view === "sin-aviso";
  const total = isUnlisted ? props.length : items.length;
  const portalName = modal.portal === "todos" ? "todos los portales" : (PORTAL_LABEL[modal.portal] ?? modal.portal);

  return (
    <Sheet
      open
      onClose={onClose}
      title={VIEW_TITLE[modal.view]}
      description={`${portalName} · ${total} ${isUnlisted ? (total === 1 ? "propiedad" : "propiedades") : total === 1 ? "aviso" : "avisos"}`}
      maxWidth="sm:max-w-2xl"
      headerExtra={
        <div className="flex flex-col gap-2 px-4 pb-3 sm:px-5">
          <Segmented
            value={modal.portal}
            onChange={(p) => {
              setOpenId(null);
              onChange({ ...modal, portal: p });
            }}
            options={[{ key: "todos", label: "Todos" }, ...portals.map((p) => ({ key: p.portal, label: PORTAL_LABEL[p.portal] ?? p.portal }))]}
          />
          <Segmented
            value={modal.view}
            onChange={(v) => {
              setOpenId(null);
              onChange({ ...modal, view: v as View });
            }}
            options={VIEWS}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Buscar por dirección, título o código"
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
            {!isUnlisted && (
              <ProblemFilter
                value={activeProblem}
                onChange={(v) => {
                  setOpenId(null);
                  setProblem(v);
                }}
                options={problems}
              />
            )}
          </div>
        </div>
      }
    >
      {total === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-text-muted">
          {isUnlisted ? "No hay propiedades con avisos faltantes." : modal.view === "errores" ? "No hay avisos con errores." : "No hay avisos para mostrar."}
        </p>
      ) : isUnlisted ? (
        <ul className="flex flex-col gap-2">
          {props.slice(0, 300).map((u) => (
            <li key={u.id}>
              <Link
                href={fichaHref(u)}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-text">{u.address}</span>
                  <span className="block text-xs text-text-muted">Sin aviso en {u.missing.map((m) => PORTAL_LABEL[m] ?? m).join(", ")}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-info">Abrir ficha →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 300).map((l) => {
            const key = `${l.portal}:${l.id}`;
            return (
              <ModalRow
                key={key}
                l={l}
                showPortal={modal.portal === "todos"}
                open={openId === key}
                onToggle={() => setOpenId(openId === key ? null : key)}
                addressById={addressById}
              />
            );
          })}
          {total > 300 && <li className="px-2 text-xs text-text-faint">Se muestran los primeros 300. Usá el buscador para el resto.</li>}
        </ul>
      )}
    </Sheet>
  );
}

function ModalRow({
  l,
  showPortal,
  open,
  onToggle,
  addressById,
}: {
  l: DifusionListing;
  showPortal: boolean;
  open: boolean;
  onToggle: () => void;
  addressById: Map<string, string>;
}) {
  const address = l.property?.address ?? l.address ?? l.title ?? `Aviso ${l.externalId}`;
  const first = l.issues.find((i) => i.level === "error") ?? l.issues.find((i) => i.level === "warn") ?? l.issues[0];
  const plan = planLabel(l.plan);
  return (
    <li className={`overflow-hidden rounded-2xl border bg-surface transition-colors ${open ? "border-border-strong" : "border-border"}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-bg">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-bg">
          {l.pictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.pictureUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-text">{address}</span>
          <span className="block truncate text-xs text-text-muted">
            {showPortal ? `${PORTAL_LABEL[l.portal] ?? l.portal} · ` : ""}
            {first ? readableMessage(l, first.message, addressById) : `${STATUS_LABEL[l.status] ?? l.status}${plan ? ` · ${plan}` : ""}`}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-text-muted">{PORTAL_LABEL[l.portal] ?? l.portal}</span>
            <StatusChip l={l} />
            {plan && <span className="text-[11.5px] text-text-muted">{plan}</span>}
            {l.quality !== null && <QualityBar value={l.quality} />}
            {l.code && <span className="text-[11.5px] text-text-faint">{l.code}</span>}
          </div>
          {l.issues.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {l.issues.map((i, n) => (
                <li key={n} className="flex gap-2 text-[13px] leading-snug">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.level === "error" ? "bg-terra" : i.level === "warn" ? "bg-warning" : "bg-border-strong"}`} />
                  <span className={i.level === "error" ? "text-text" : "text-text-muted"}>{readableMessage(l, i.message, addressById)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text-muted">El portal no marca nada para revisar en este aviso.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {l.property ? (
              <Link href={fichaHref(l.property)} prefetch={false} className="inline-flex h-10 items-center rounded-full bg-dark px-4 text-[13px] font-semibold text-dark-fg active:opacity-80">
                Abrir ficha
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center text-xs text-text-faint">No está vinculado a una propiedad del sistema</span>
            )}
            {l.url && (
              <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-border px-4 text-[13px] font-semibold text-text-muted active:bg-bg">
                Ver publicación en {PORTAL_LABEL[l.portal] ?? "el portal"} ↗
              </a>
            )}
          </div>
        </div>
      )}
    </li>
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
            <Link href={fichaHref(l.property)} prefetch={false} className="text-text-muted hover:text-text hover:underline">
              Abrir ficha
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
            <Link href={fichaHref(u)} prefetch={false} className="truncate text-sm font-bold text-text hover:underline">
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
