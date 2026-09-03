"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select-field";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { buildPropertyWhatsAppLink } from "@/lib/whatsapp";
import { MlPublishWizard } from "./ml-publish-wizard";
import { PortalesPanel } from "./portales-panel";
import { PhotosEditor } from "./photos-editor";

const PropertiesMap = dynamic(
  () => import("./properties-map").then((mod) => mod.PropertiesMap),
  { ssr: false, loading: () => <div className="flex h-[500px] items-center justify-center rounded-3xl border border-border bg-surface text-[13px] text-text-faint">Cargando mapa...</div> }
);

interface Property {
  id: string;
  externalId: number | null;
  source: string;
  address: string;
  realAddress: string | null;
  publicationTitle: string | null;
  referenceCode: string | null;
  publicUrl: string | null;
  city: string | null;
  province: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  roomAmount: number | null;
  bedrooms: number | null;
  bathroomAmount: number | null;
  parkingLotAmount: number | null;
  totalSurface: number | null;
  roofedSurface: number | null;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  geoLat: number | null;
  geoLong: number | null;
  ownerReportData: Record<string, unknown> | null;
  createdAt: string;
  _count?: { visitas: number };
  mlPublication?: { status: string; permalink: string | null; published: boolean } | null;
  portalPublications?: { portal: string; status: string; permalink: string | null }[];
}

interface PropiedadesClientProps {
  properties: Property[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  isAdmin: boolean;
  usersForAssignments: Array<{ id: string; fullName: string | null; email: string }>;
  propertiesForAssignments: Array<{ id: string; address: string }>;
  filters: {
    q: string;
    status: string;
    operation: string;
    type: string;
    city: string;
    currency: string;
    sort: string;
  };
}

interface PdfPopupState {
  property: Property;
  top: number;
  left: number;
}

/** Foto de una propiedad (respuesta de /api/propiedades/[id]/fotos). */
interface ModalPhoto {
  image: string;
  thumb: string | null;
  original: string | null;
  order: number;
  description: string | null;
  isFrontCover: boolean;
  isBlueprint: boolean;
}

const PROPERTY_TYPES = [
  { value: "", label: "Sin especificar" },
  { value: "departamento", label: "Departamento" },
  { value: "casa", label: "Casa" },
  { value: "local", label: "Local" },
  { value: "terreno", label: "Terreno" },
  { value: "oficina", label: "Oficina" },
  { value: "otro", label: "Otro" },
];

// Estilos compartidos de los campos del modal de propiedad.
const MODAL_FIELD =
  "w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";
const MODAL_LABEL = "mb-1 block text-[12.5px] font-semibold text-text-muted";

const PROPERTY_STATUSES = [
  { value: "activa", label: "Activa", color: "bg-sage-chip text-olive-light" },
  { value: "vendida", label: "Vendida", color: "bg-info-chip text-info" },
  { value: "alquilada", label: "Alquilada", color: "bg-sand-chip text-warning" },
  { value: "suspendida", label: "Suspendida", color: "bg-clay-chip text-terra" },
];

/**
 * Distintivo para propiedades cargadas a mano (no importadas de un portal).
 * Chip con lápiz + "Manual" para que se entienda el origen de un vistazo.
 */
function ManualChip() {
  return (
    <span
      title="Propiedad cargada manualmente"
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-sand-chip px-2 py-0.5 text-[10px] font-bold text-warning"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      Manual
    </span>
  );
}

const TH_CLASS =
  "px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint";

/**
 * Header de columna con filtro embebido (estilo Airtable).
 * Botón que abre un popover anclado; cierra por click-fuera o Escape.
 * `active` pinta un punto para indicar filtro/orden aplicado.
 */
function ColumnFilter({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  // Popover posicionado `fixed` (como pdfPopup): escapa del overflow de la tabla.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const open = coords !== null;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setCoords(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCoords(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) return setCoords(null);
    const r = btnRef.current!.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 uppercase tracking-[0.12em] transition-colors hover:text-text ${active ? "text-text" : ""}`}
      >
        {label}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          ref={popRef}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 min-w-[180px] rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          {children(() => setCoords(null))}
        </div>
      )}
    </>
  );
}

/** Fila de opción dentro de un ColumnFilter (con check en la activa). */
function FilterOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] normal-case tracking-normal transition-colors hover:bg-bg ${selected ? "font-bold text-text" : "font-medium text-text-muted"}`}
    >
      {label}
      {selected && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

const PANEL_INPUT =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] normal-case tracking-normal text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";
const PANEL_BTN =
  "flex-1 rounded-xl bg-dark px-3 py-2 text-[12.5px] font-bold normal-case tracking-normal text-dark-fg transition-opacity hover:opacity-90";

const PANEL_LABEL = "px-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint";

/** Panel de precio: orden asc/desc + moneda + rango min/max. */
function PriceFilterPanel({
  minInit,
  maxInit,
  sort,
  currency,
  onApply,
  onSort,
  onCurrency,
}: {
  minInit: string;
  maxInit: string;
  sort: string;
  currency: string;
  onApply: (min: string, max: string) => void;
  onSort: (dir: "price_asc" | "price_desc") => void;
  onCurrency: (c: string) => void;
}) {
  const [min, setMin] = useState(minInit);
  const [max, setMax] = useState(maxInit);
  return (
    <div className="flex w-[240px] flex-col gap-2.5 p-1.5">
      {/* Orden */}
      <div>
        <p className={PANEL_LABEL}>Ordenar</p>
        <div className="mt-1 flex gap-1.5">
          <button
            type="button"
            onClick={() => onSort("price_asc")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-bold normal-case tracking-normal transition-colors ${sort === "price_asc" ? "bg-sage-chip text-olive-light" : "bg-bg text-text-muted hover:bg-sand-chip"}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            Menor
          </button>
          <button
            type="button"
            onClick={() => onSort("price_desc")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-bold normal-case tracking-normal transition-colors ${sort === "price_desc" ? "bg-clay-chip text-terra" : "bg-bg text-text-muted hover:bg-sand-chip"}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            Mayor
          </button>
        </div>
      </div>

      {/* Moneda — segmented */}
      <div>
        <p className={PANEL_LABEL}>Moneda</p>
        <div className="mt-1 flex gap-0.5 rounded-full bg-bg p-1">
          {[
            { v: "", label: "Todas" },
            { v: "USD", label: "USD" },
            { v: "ARS", label: "ARS" },
          ].map((c) => (
            <button
              key={c.v || "all"}
              type="button"
              onClick={() => onCurrency(c.v)}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-bold normal-case tracking-normal transition-colors ${currency === c.v ? "bg-dark text-dark-fg" : "text-text-faint hover:text-text"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango */}
      <div>
        <p className={PANEL_LABEL}>Rango</p>
        <div className="mt-1 flex items-center gap-2">
          <input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="Mín" className={PANEL_INPUT} />
          <span className="text-text-faint">–</span>
          <input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} placeholder="Máx" className={PANEL_INPUT} />
        </div>
      </div>

      <button type="button" onClick={() => onApply(min, max)} className={PANEL_BTN}>
        Aplicar rango
      </button>
    </div>
  );
}

/** Panel de ciudad: input de texto con label + acciones. */
function CityFilterPanel({ init, onApply }: { init: string; onApply: (city: string) => void }) {
  const [city, setCity] = useState(init);
  return (
    <form
      className="flex w-[200px] flex-col gap-2 p-1.5"
      onSubmit={(e) => { e.preventDefault(); onApply(city.trim()); }}
    >
      <p className={PANEL_LABEL}>Ciudad</p>
      <div className="relative">
        <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          autoFocus
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Escribí una ciudad…"
          className={`${PANEL_INPUT} h-9 py-0 pl-8 pr-7`}
        />
        {city && (
          <button
            type="button"
            onClick={() => setCity("")}
            title="Borrar"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-bg hover:text-text"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {init && (
          <button
            type="button"
            onClick={() => onApply("")}
            className="rounded-xl bg-bg px-3 py-1.5 text-[12.5px] font-bold normal-case tracking-normal text-text-muted transition-colors hover:bg-sand-chip"
          >
            Limpiar
          </button>
        )}
        <button type="submit" className={`${PANEL_BTN} py-1.5`}>Aplicar</button>
      </div>
    </form>
  );
}

/**
 * Chip de estado de la publicación en MercadoLibre.
 * Solo se muestra si la propiedad tiene item publicado (o en error).
 */
const ML_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "ML activa", cls: "border-success/30 bg-success/10 text-success" },
  paused: { label: "ML pausada", cls: "border-warning/30 bg-warning-chip text-warning" },
  closed: { label: "ML cerrada", cls: "border-border bg-bg text-text-muted" },
  publishing: { label: "ML publicando…", cls: "border-info/30 bg-info/10 text-info" },
  error: { label: "ML error", cls: "border-danger/30 bg-danger-chip text-danger" },
};
function MlChip({ status, permalink }: { status: string; permalink: string | null }) {
  const c = ML_CHIP[status];
  if (!c) return null;
  const chip = (
    <span
      title={`MercadoLibre: ${c.label}`}
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
      {c.label}
    </span>
  );
  return permalink ? (
    <a href={permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {chip}
    </a>
  ) : (
    chip
  );
}

/**
 * Chip de estado de la publicación en ZonaProp / ArgenProp (mismo idioma visual
 * que el de ML). Un punto del color del portal + estado. Sólo se muestra si hay
 * fila de publicación para ese portal.
 */
const PUB_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "activa", cls: "border-success/30 bg-success/10 text-success" },
  draft: { label: "borrador", cls: "border-border bg-sand-chip text-warning" },
  publishing: { label: "publicando…", cls: "border-info/30 bg-info/10 text-info" },
  paused: { label: "pausada", cls: "border-warning/30 bg-warning-chip text-warning" },
  closed: { label: "cerrada", cls: "border-border bg-bg text-text-muted" },
  error: { label: "error", cls: "border-danger/30 bg-danger-chip text-danger" },
};
const PORTAL_UI: Record<string, { abbr: string; name: string; dot: string }> = {
  zonaprop: { abbr: "ZP", name: "ZonaProp", dot: "#7b61ff" },
  argenprop: { abbr: "AP", name: "ArgenProp", dot: "#e2574c" },
};
function PortalChip({ portal, status, permalink }: { portal: string; status: string; permalink: string | null }) {
  const c = PUB_CHIP[status];
  const ui = PORTAL_UI[portal];
  if (!c || !ui) return null;
  const chip = (
    <span
      title={`${ui.name}: ${c.label}`}
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ui.dot }} aria-hidden />
      {ui.abbr} {c.label}
    </span>
  );
  return permalink ? (
    <a href={permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {chip}
    </a>
  ) : (
    chip
  );
}

function getStatusColor(status: string) {
  return PROPERTY_STATUSES.find((s) => s.value === status)?.color ?? "bg-bg text-text-faint";
}

function getStatusLabel(status: string) {
  return PROPERTY_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function getUserLabel(user: { fullName: string | null; email: string }) {
  return user.fullName?.trim() || user.email;
}

export function PropiedadesClient({
  properties,
  page,
  totalPages,
  total,
  limit,
  totalAll,
  isAdmin,
  usersForAssignments,
  propertiesForAssignments,
  filters,
}: PropiedadesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [operationFilter, setOperationFilter] = useState(filters.operation);
  const [typeFilter, setTypeFilter] = useState(filters.type);
  const [cityFilter, setCityFilter] = useState(filters.city);
  const [currencyFilter, setCurrencyFilter] = useState(filters.currency);
  const [sortFilter, setSortFilter] = useState(filters.sort || "created_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  // Pestañas del modal. Las fotos NO viajan con la paginación: se piden al abrir.
  const [modalTab, setModalTab] = useState<"datos" | "ubicacion" | "fotos" | "portales">("datos");
  const [modalPhotos, setModalPhotos] = useState<ModalPhoto[] | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"save" | "delete" | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [syncingMl, setSyncingMl] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sincroniza los filtros con la URL cuando cambia por navegación (back/forward,
  // limpiar chip, etc.) — si no, los headers mostrarían un estado activo desfasado.
  useEffect(() => {
    setQuery(filters.q);
    setStatusFilter(filters.status);
    setOperationFilter(filters.operation);
    setTypeFilter(filters.type);
    setCityFilter(filters.city);
    setCurrencyFilter(filters.currency);
    setSortFilter(filters.sort || "created_desc");
  }, [filters.q, filters.status, filters.operation, filters.type, filters.city, filters.currency, filters.sort]);

  async function handleSyncMl() {
    setSyncingMl(true);
    try {
      const res = await fetch("/api/integrations/mercadolibre/publications/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo sincronizar");
        return;
      }
      toast.success(body.message ?? "Estados sincronizados");
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar");
    } finally {
      setSyncingMl(false);
    }
  }

  // PDF popup & owner modal
  const [pdfPopup, setPdfPopup] = useState<PdfPopupState | null>(null);
  const [ownerModalProperty, setOwnerModalProperty] = useState<Property | null>(null);
  const [wizardProperty, setWizardProperty] = useState<Property | null>(null);
  const [ownerForm, setOwnerForm] = useState({ visitasTotales: "", visitasMes: "", quejas: "", mejoras: "" });
  const [ownerSaving, setOwnerSaving] = useState(false);

  // Resultado del OAuth de MercadoLibre (?ml_connected / ?ml_error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("ml_connected");
    const err = params.get("ml_error");
    if (connected) toast.success("MercadoLibre conectado");
    if (err) toast.error(err);
    if (connected || err) {
      params.delete("ml_connected");
      params.delete("ml_error");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  // Cerrar popup PDF al hacer click fuera
  useEffect(() => {
    if (!pdfPopup) return;
    function handleClick() {
      setPdfPopup(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pdfPopup]);

  useEffect(() => {
    if (!pdfPopup) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPdfPopup(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pdfPopup]);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    };

    setOrDelete("q", query);
    setOrDelete("status", statusFilter);
    setOrDelete("operation", operationFilter);
    setOrDelete("type", typeFilter);
    setOrDelete("city", cityFilter);
    setOrDelete("currency", currencyFilter);
    setOrDelete("sort", sortFilter);

    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  // Aplica uno o más filtros al instante (para popovers de header desktop).
  function pushFilters(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setOperationFilter("");
    setTypeFilter("");
    setCityFilter("");
    setCurrencyFilter("");
    setSortFilter("created_desc");
    startTransition(() => router.push(pathname));
  }

  // Limpia un filtro individual: resetea su estado y saca su searchParam.
  function clearFilter(key: string, reset: () => void) {
    reset();
    pushFilters({ [key]: "" });
  }

  const activeFilters: { key: string; label: string; reset: () => void }[] = [
    query && { key: "q", label: `Búsqueda: ${query}`, reset: () => setQuery("") },
    statusFilter && { key: "status", label: `Estado: ${getStatusLabel(statusFilter)}`, reset: () => setStatusFilter("") },
    operationFilter && { key: "operation", label: `Operación: ${operationFilter}`, reset: () => setOperationFilter("") },
    typeFilter && { key: "type", label: `Tipo: ${typeFilter}`, reset: () => setTypeFilter("") },
    cityFilter && { key: "city", label: `Ciudad: ${cityFilter}`, reset: () => setCityFilter("") },
    currencyFilter && { key: "currency", label: `Moneda: ${currencyFilter}`, reset: () => setCurrencyFilter("") },
  ].filter(Boolean) as { key: string; label: string; reset: () => void }[];

  // Filtros "extra" (los del panel colapsable mobile, excluyendo búsqueda y estado)
  const extraActiveCount = [operationFilter, typeFilter, cityFilter, currencyFilter, sortFilter !== "created_desc" ? sortFilter : ""].filter(Boolean).length;

  function handleNew() {
    setEditProperty(null);
    setModalTab("datos");
    setModalPhotos(null);
    setModalOpen(true);
  }

  function handleEdit(p: Property) {
    setEditProperty(p);
    setModalTab("datos");
    setModalPhotos(null);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditProperty(null);
    setError(null);
    setModalTab("datos");
    setModalPhotos(null);
  }

  // Responsables internos de la propiedad abierta (ruteo de consultas).
  const [respUsers, setRespUsers] = useState<{ id: string; fullName: string | null; email: string }[]>([]);
  const [respAssigned, setRespAssigned] = useState<string[]>([]);
  const [respSaving, setRespSaving] = useState(false);

  useEffect(() => {
    if (!modalOpen || !editProperty?.id) {
      setRespAssigned([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/propiedades/${editProperty.id}/responsables`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setRespUsers(body?.data?.users ?? []);
        setRespAssigned(body?.data?.assigned ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modalOpen, editProperty?.id]);

  async function toggleResponsible(userId: string) {
    if (!editProperty?.id) return;
    const next = respAssigned.includes(userId)
      ? respAssigned.filter((u) => u !== userId)
      : [...respAssigned, userId];
    setRespAssigned(next); // optimista
    setRespSaving(true);
    try {
      const res = await fetch(`/api/propiedades/${editProperty.id}/responsables`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("No se pudo guardar el responsable");
      setRespAssigned(respAssigned); // rollback
    } finally {
      setRespSaving(false);
    }
  }

  // Deep-link: /propiedades?q=...&open=<id> abre el modal de esa propiedad
  // (lo usan las notificaciones de contactos recientes). El param se limpia
  // para que un back/refresh no reabra el modal.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const target = properties.find((p) => p.id === openId);
    if (target) handleEdit(target);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, properties]);

  // Fotos bajo demanda: se piden al abrir una propiedad (no en la paginación).
  useEffect(() => {
    if (!modalOpen || !editProperty?.id) return;
    let cancelled = false;
    setPhotosLoading(true);
    fetch(`/api/propiedades/${editProperty.id}/fotos`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setModalPhotos((body?.data?.photos ?? []) as ModalPhoto[]);
      })
      .catch(() => {
        if (!cancelled) setModalPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editProperty?.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      address: form.get("address") as string,
      realAddress: (form.get("realAddress") as string) || null,
      publicationTitle: (form.get("publicationTitle") as string) || null,
      referenceCode: (form.get("referenceCode") as string) || null,
      publicUrl: (form.get("publicUrl") as string) || null,
      city: (form.get("city") as string) || null,
      province: (form.get("province") as string) || null,
      zone: (form.get("zone") as string) || null,
      type: (form.get("type") as string) || null,
      status: form.get("status") as string,
      roomAmount: (form.get("roomAmount") as string) || null,
      bedrooms: (form.get("bedrooms") as string) || null,
      bathroomAmount: (form.get("bathroomAmount") as string) || null,
      parkingLotAmount: (form.get("parkingLotAmount") as string) || null,
      totalSurface: (form.get("totalSurface") as string) || null,
      roofedSurface: (form.get("roofedSurface") as string) || null,
      operationType: (form.get("operationType") as string) || null,
      operationPrice: (form.get("operationPrice") as string) || null,
      operationCurrency: (form.get("operationCurrency") as string) || null,
      geoLat: (form.get("geoLat") as string) || null,
      geoLong: (form.get("geoLong") as string) || null,
    };

    try {
      const url = editProperty
        ? `/api/propiedades/${editProperty.id}`
        : "/api/propiedades";
      const method = editProperty ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Error al guardar");
        return;
      }

      toast.success(editProperty ? "Propiedad actualizada" : "Propiedad creada");
      handleClose();
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editProperty) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/propiedades/${editProperty.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Error al eliminar");
        return;
      }

      toast.success("Propiedad eliminada");
      handleClose();
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAssigning(true);

    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: form.get("propertyId"),
      assignedToUserId: form.get("assignedToUserId"),
      title: form.get("title") || null,
      notes: form.get("notes") || null,
      dueDate: form.get("dueDate") || null,
      status: "pendiente",
    };

    try {
      const res = await fetch("/api/seguimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo asignar el seguimiento");
        return;
      }

      toast.success("Seguimiento asignado");
      setAssignModalOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAssigning(false);
    }
  }

  function handlePdfClick(
    e: React.MouseEvent<HTMLButtonElement>,
    property: Property,
    align: "left" | "right" = "right"
  ) {
    e.stopPropagation();
    if (pdfPopup?.property.id === property.id) {
      setPdfPopup(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 132;
    const menuHeight = 84;
    const viewportPadding = 8;
    const preferredLeft = align === "right" ? rect.right - menuWidth : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= menuHeight + viewportPadding
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - menuHeight - 6);

    setPdfPopup({
      property,
      left,
      top,
    });
  }

  function handlePdfNoDueno(propertyId: string) {
    setPdfPopup(null);
    window.open(`/api/propiedades/${propertyId}/pdf`, "_blank");
  }

  function handlePdfDueno(p: Property) {
    setPdfPopup(null);
    const data = (p.ownerReportData ?? {}) as Record<string, unknown>;
    setOwnerForm({
      visitasTotales: data.visitasTotales != null ? String(data.visitasTotales) : "",
      visitasMes: data.visitasMes != null ? String(data.visitasMes) : "",
      quejas: (data.quejas as string) ?? "",
      mejoras: (data.mejoras as string) ?? "",
    });
    setOwnerModalProperty(p);
  }

  async function handleOwnerSubmit() {
    if (!ownerModalProperty) return;
    setOwnerSaving(true);
    const payload = {
      visitasTotales: ownerForm.visitasTotales ? Number(ownerForm.visitasTotales) : null,
      visitasMes: ownerForm.visitasMes ? Number(ownerForm.visitasMes) : null,
      quejas: ownerForm.quejas,
      mejoras: ownerForm.mejoras,
    };
    try {
      const res = await fetch(`/api/propiedades/${ownerModalProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerReportData: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Error al guardar");
        return;
      }
      setOwnerModalProperty(null);
      window.open(`/api/propiedades/${ownerModalProperty.id}/pdf?mode=owner`, "_blank");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setOwnerSaving(false);
    }
  }

  const isEdit = !!editProperty;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Propiedades</h1>
          <p className="text-[12.5px] text-text-faint">
            Mostrando {properties.length} de {total} resultado{total !== 1 ? "s" : ""} · Total global: {totalAll}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setAssignModalOpen(true)}
              title="Asignar seguimiento"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg sm:px-4"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span className="hidden sm:inline">Asignar seguimiento</span>
            </button>
          )}
          <button
            onClick={handleSyncMl}
            disabled={syncingMl}
            title="Sincronizar el estado de las publicaciones de MercadoLibre"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg disabled:opacity-50 sm:px-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={syncingMl ? "animate-spin" : ""}>
              <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            <span className="hidden sm:inline">{syncingMl ? "Sincronizando..." : "Sincronizar ML"}</span>
          </button>
          <div className="inline-flex h-11 items-center gap-0.5 rounded-full border border-border bg-surface p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
                viewMode === "list" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
                viewMode === "map" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span className="hidden sm:inline">Mapa</span>
            </button>
          </div>
          <button
            onClick={handleNew}
            title="Nueva propiedad"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-3.5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 active:opacity-90 sm:px-5"
          >
            <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">Nueva propiedad</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[20px] border border-border bg-surface p-4 xl:border-0 xl:bg-transparent xl:p-0">

        {/* Mobile: búsqueda + botón filtros siempre visibles */}
        <div className="flex gap-2 sm:hidden">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((f) => !f)}
            className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${filtersOpen || extraActiveCount > 0 ? "border-transparent bg-sand-chip text-warning" : "border-border bg-surface text-text-muted"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            {extraActiveCount > 0 ? `Filtros (${extraActiveCount})` : "Filtros"}
          </button>
        </div>

        {/* Mobile: estado + aplicar en una fila */}
        <div className="mt-2 flex gap-2 sm:hidden">
          <SelectField
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            wrapperClassName="min-w-0 flex-1"
          >
            <option value="">Todos los estados</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </SelectField>
          <button
            onClick={() => applyFilters(1)}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            Aplicar
          </button>
        </div>

        {/* Mobile: panel colapsable */}
        {filtersOpen && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:hidden">
            <SelectField
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
            >
              <option value="">Todas las operaciones</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </SelectField>
            <SelectField
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {PROPERTY_TYPES.filter((t) => t.value).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </SelectField>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Ciudad"
              className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
            <SelectField
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
            >
              <option value="">Moneda</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </SelectField>
            <SelectField
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
            >
              <option value="created_desc">Más recientes</option>
              <option value="price_asc">Precio menor</option>
              <option value="price_desc">Precio mayor</option>
              <option value="surface_desc">Mayor superficie</option>
              <option value="external_newest">Más nuevas</option>
            </SelectField>
          </div>
        )}

        {/* Desktop grande (xl+): buscador + hint hacia los filtros de columna */}
        <div className="hidden items-center gap-3 xl:flex">
          <div className="relative w-full max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por dirección, código, título..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-faint">
            Filtrá y ordená desde las columnas de la tabla
            <svg className="-mb-2 self-end text-accent" width="48" height="34" viewBox="0 0 48 34" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5c14 1 24 6 27 22" />
              <path d="M22 24l8 4 4-8" />
            </svg>
          </span>
        </div>

        {/* Desktop chico (sm–lg): todos los filtros en grid (sin tabla, no hay headers) */}
        <div className="hidden sm:grid xl:hidden grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por dirección, código, título..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <SelectField
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </SelectField>
          <SelectField
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
          >
            <option value="">Todas las operaciones</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
          </SelectField>
          <SelectField
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {PROPERTY_TYPES.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </SelectField>
          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Ciudad"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
          <SelectField
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="">Moneda</option>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </SelectField>
          <SelectField
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
          >
            <option value="created_desc">Más recientes</option>
            <option value="price_asc">Precio menor</option>
            <option value="price_desc">Precio mayor</option>
            <option value="surface_desc">Mayor superficie</option>
            <option value="external_newest">Más nuevas</option>
          </SelectField>
        </div>

        <div className={`mt-3 flex-wrap items-center gap-2 ${activeFilters.length > 0 ? "flex" : "flex xl:hidden"}`}>
          <button
            onClick={() => applyFilters(1)}
            className="hidden h-10 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:inline-flex xl:hidden"
          >
            Aplicar filtros
          </button>
          {activeFilters.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearFilter(chip.key, chip.reset)}
                title="Quitar filtro"
                className="group inline-flex items-center gap-1.5 rounded-full bg-sand-chip py-1.5 pl-3 pr-2 text-[12px] font-semibold text-text-muted transition-colors hover:bg-clay-chip hover:text-terra"
              >
                {chip.label}
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/5 text-[10px] leading-none text-text-faint transition-colors group-hover:bg-terra/20 group-hover:text-terra">
                  ✕
                </span>
              </button>
            ))}
            {activeFilters.length >= 2 && (
              <button
                onClick={resetFilters}
                className="px-2 text-[12px] font-bold text-text-faint underline-offset-2 transition-colors hover:text-text hover:underline"
              >
                Limpiar todo
              </button>
            )}
        </div>
      </div>

      {/* Área de resultados — barra de carga arriba + atenuado mientras carga */}
      <div className="relative">
        {/* Barra de carga (useTransition) — colorida, sin ocupar espacio en el flujo */}
        {isPending && (
          <div className="absolute -top-2 left-0 right-0 z-10 h-1 overflow-hidden rounded-full bg-accent/10">
            <div className="h-full w-1/3 animate-loading-bar rounded-full bg-gradient-to-r from-accent via-olive-bright to-terra shadow-[0_0_8px_var(--color-accent)]" />
          </div>
        )}
      <div className={`flex flex-col gap-4 transition-opacity duration-200 ${isPending ? "pointer-events-none opacity-50" : "opacity-100"}`}>
      {/* Map view */}
      {viewMode === "map" && (
        <PropertiesMap
          properties={properties
            .filter((p) => p.geoLat != null && p.geoLong != null)
            .map((p) => ({
              id: p.id,
              address: p.address,
              geoLat: p.geoLat!,
              geoLong: p.geoLong!,
              operationType: p.operationType,
              operationPrice: p.operationPrice,
              operationCurrency: p.operationCurrency,
              type: p.type,
              status: p.status,
            }))}
        />
      )}

      {/* Cards — solo mobile */}
      {viewMode === "list" && <div className="sm:hidden space-y-2">
        {properties.length === 0 ? (
          <div className="rounded-[20px] bg-bg px-6 py-8 text-center">
            <p className="text-[12.5px] text-text-faint">No hay propiedades para los filtros seleccionados</p>
          </div>
        ) : (
          properties.map((p) => {
            const specs = [
              p.roomAmount ? `${p.roomAmount} amb` : null,
              p.bedrooms ? `${p.bedrooms} dorm` : null,
              p.bathroomAmount ? `${p.bathroomAmount} baño${p.bathroomAmount !== 1 ? "s" : ""}` : null,
              p.totalSurface ? `${p.totalSurface} m²` : null,
            ].filter(Boolean);
            return (
            <div
              key={p.id}
              onClick={() => handleEdit(p)}
              className="cursor-pointer overflow-hidden rounded-[18px] border border-border bg-surface active:bg-bg"
            >
              <div className="p-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-bold leading-tight text-text">{p.address}</p>
                  {p.source === "manual" && <ManualChip />}
                  {p.mlPublication?.published && (
                    <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                  )}
                  {p.portalPublications?.map((pub) => (
                    <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                  ))}
                </div>
                {(p.city || p.zone || p.type) && (
                  <p className="mt-0.5 truncate text-[11px] text-text-faint">
                    {[p.city, p.zone, p.type].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-0.5 truncate text-[11.5px] font-semibold text-text-muted">
                  {p.operationType ?? "Operación"} · {p.operationCurrency ?? ""} {p.operationPrice?.toLocaleString("es-AR") ?? "s/d"}
                </p>
                {/* Meta con iconitos: specs · referencia · visitas */}
                {(specs.length > 0 || p.referenceCode || (p._count?.visitas ?? 0) > 0) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                    {specs.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-6h6v6" /></svg>
                        {specs.join(" · ")}
                      </span>
                    )}
                    {p.referenceCode && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                        {p.referenceCode}
                      </span>
                    )}
                    {(p._count?.visitas ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        {p._count!.visitas} visita{p._count!.visitas !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
                {/* Acciones */}
                <div className="mt-2 flex gap-2">
                  <a
                    href={buildPropertyWhatsAppLink(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sage-chip px-3 text-[11px] font-bold text-olive-light"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <button
                    onClick={(e) => handlePdfClick(e, p, "left")}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sand-chip px-3 text-[11px] font-bold text-warning"
                  >
                    PDF
                  </button>
                </div>
              </div>
              {/* Footer de estado = franja de color */}
              <div className={`flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11.5px] font-bold ${getStatusColor(p.status)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {getStatusLabel(p.status)}
              </div>
            </div>
          );})
        )}
      </div>}

      {/* Grid 2→3 columnas — sm hasta xl */}
      {viewMode === "list" && (
        <div className="hidden sm:grid xl:hidden grid-cols-2 lg:grid-cols-3 gap-2">
          {properties.length === 0 ? (
            <div className="col-span-3 rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
              No hay propiedades para los filtros seleccionados
            </div>
          ) : (
            properties.map((p) => (
              <div
                key={p.id}
                onClick={() => handleEdit(p)}
                className="flex cursor-pointer flex-col rounded-[18px] border border-border bg-surface p-4 active:bg-bg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[13.5px] font-bold text-text">{p.address}</p>
                      {p.source === "manual" && <ManualChip />}
                      {p.mlPublication?.published && (
                        <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                      )}
                      {p.portalPublications?.map((pub) => (
                        <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                      ))}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-text-faint">
                      {p.operationType ?? "Operación"} · {p.operationCurrency ?? ""} {p.operationPrice?.toLocaleString("es-AR") ?? "s/d"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-text-faint">{p.city ?? ""}{p.type ? ` · ${p.type}` : ""}</p>
                  </div>
                  <span className={`ml-1 mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusColor(p.status)}`}>
                    {getStatusLabel(p.status)}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={buildPropertyWhatsAppLink(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sage-chip px-3 text-[11px] font-bold text-olive-light"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <div className="relative">
                    <button
                      onClick={(e) => handlePdfClick(e, p, "left")}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-[11px] font-medium text-text-muted"
                    >
                      PDF
                    </button>
                  </div>
                  {p.publicUrl && (
                    <a
                      href={p.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-bg px-3 text-[11px] font-bold text-text-muted"
                    >
                      Tokko
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Table — solo desktop xl+ */}
      {viewMode === "list" && <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface xl:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH_CLASS}>Dirección</th>
                <th className={TH_CLASS}>Código</th>
                <th className={TH_CLASS}>
                  <ColumnFilter
                    label="Precio"
                    active={!!(searchParams.get("minPrice") || searchParams.get("maxPrice") || currencyFilter || sortFilter === "price_asc" || sortFilter === "price_desc")}
                  >
                    {(close) => (
                      <PriceFilterPanel
                        minInit={searchParams.get("minPrice") ?? ""}
                        maxInit={searchParams.get("maxPrice") ?? ""}
                        sort={sortFilter}
                        currency={currencyFilter}
                        onApply={(min, max) => { pushFilters({ minPrice: min, maxPrice: max }); close(); }}
                        onSort={(dir) => { const next = sortFilter === dir ? "created_desc" : dir; setSortFilter(next); pushFilters({ sort: next === "created_desc" ? "" : next }); }}
                        onCurrency={(c) => { const next = currencyFilter === c ? "" : c; setCurrencyFilter(next); pushFilters({ currency: next }); }}
                      />
                    )}
                  </ColumnFilter>
                </th>
                <th className={TH_CLASS}>
                  <ColumnFilter label="Ciudad" active={!!cityFilter}>
                    {(close) => (
                      <CityFilterPanel
                        init={cityFilter}
                        onApply={(city) => { setCityFilter(city); pushFilters({ city }); close(); }}
                      />
                    )}
                  </ColumnFilter>
                </th>
                <th className={TH_CLASS}>
                  <ColumnFilter label="Tipo" active={!!typeFilter}>
                    {(close) => (
                      <>
                        <FilterOption label="Todos" selected={!typeFilter} onClick={() => { setTypeFilter(""); pushFilters({ type: "" }); close(); }} />
                        {PROPERTY_TYPES.filter((t) => t.value).map((t) => (
                          <FilterOption key={t.value} label={t.label} selected={typeFilter === t.value} onClick={() => { const next = typeFilter === t.value ? "" : t.value; setTypeFilter(next); pushFilters({ type: next }); close(); }} />
                        ))}
                      </>
                    )}
                  </ColumnFilter>
                </th>
                <th className={TH_CLASS}>
                  <ColumnFilter label="Estado" active={!!statusFilter}>
                    {(close) => (
                      <>
                        <FilterOption label="Todos" selected={!statusFilter} onClick={() => { setStatusFilter(""); pushFilters({ status: "" }); close(); }} />
                        {PROPERTY_STATUSES.map((s) => (
                          <FilterOption key={s.value} label={s.label} selected={statusFilter === s.value} onClick={() => { const next = statusFilter === s.value ? "" : s.value; setStatusFilter(next); pushFilters({ status: next }); close(); }} />
                        ))}
                      </>
                    )}
                  </ColumnFilter>
                </th>
                <th className={`${TH_CLASS} text-right`}>Ficha</th>
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12.5px] text-text-faint">
                    No hay propiedades para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleEdit(p)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-bg"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13.5px] font-bold text-text">{p.address}</p>
                        {p.source === "manual" && <ManualChip />}
                        {p.mlPublication?.published && (
                          <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                        )}
                        {p.portalPublications?.map((pub) => (
                          <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                        ))}
                      </div>
                      <p className="text-[11.5px] text-text-faint">{p.publicationTitle ?? p.realAddress ?? "Sin título"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-text-muted">{p.referenceCode ?? (p.externalId ? `#${p.externalId}` : "—")}</td>
                    <td className="px-4 py-3.5 font-display text-[13.5px] font-bold text-text">
                      {p.operationPrice ? `${p.operationCurrency ?? "USD"} ${p.operationPrice.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-text-muted">{p.city ?? "—"}</td>
                    <td className="px-4 py-3.5 text-[13px] capitalize text-text-muted">{p.type ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={buildPropertyWhatsAppLink(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sage-chip text-olive-light transition-opacity hover:opacity-80"
                          title="Compartir por WhatsApp"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                          </svg>
                        </a>
                        <div className="relative">
                          <button
                            onClick={(e) => handlePdfClick(e, p)}
                            title="Descargar PDF"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand-chip text-warning transition-opacity hover:opacity-80"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                        {p.publicUrl ? (
                          <a
                            href={p.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            title="Ver publicación"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg text-text-muted transition-colors hover:text-text"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 17L17 7" />
                              <path d="M7 7h10v10" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center text-xs text-text-faint">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} startTransition={startTransition} />
      </div>
      </div>

      {pdfPopup && (
        <div
          className="fixed z-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          style={{ top: `${pdfPopup.top}px`, left: `${pdfPopup.left}px`, width: "132px" }}
        >
          <button
            onClick={() => handlePdfNoDueno(pdfPopup.property.id)}
            className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            No Dueño
          </button>
          <button
            onClick={() => handlePdfDueno(pdfPopup.property)}
            className="block w-full whitespace-nowrap border-t border-border bg-sand-chip px-4 py-2.5 text-left text-[12px] font-bold text-warning transition-opacity hover:opacity-90"
          >
            Dueño
          </button>
        </div>
      )}

      {/* Modal Nueva/Editar propiedad */}
      {modalOpen && (
        <Sheet
          open={modalOpen}
          onClose={handleClose}
          maxWidth="sm:max-w-[1400px]"
          title={
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">
                {isEdit ? (editProperty?.realAddress || editProperty?.address || "Editar propiedad") : "Nueva propiedad"}
              </span>
              {isEdit && editProperty?.source === "manual" && <ManualChip />}
            </span>
          }
          headerExtra={
            <div className="scrollbar-none -mb-px flex gap-1 overflow-x-auto border-b border-border px-5 sm:px-8">
              {(
                [
                  { key: "datos", label: "Datos" },
                  { key: "ubicacion", label: "Ubicación" },
                  ...(isEdit
                    ? [
                        { key: "fotos", label: `Fotos${modalPhotos ? ` (${modalPhotos.length})` : ""}` },
                        { key: "portales", label: "Portales" },
                      ]
                    : []),
                ] as { key: typeof modalTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setModalTab(t.key)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-t-[12px] border-b-2 px-4 py-2.5 text-[13px] font-bold transition-colors ${
                    modalTab === t.key
                      ? "border-dark text-text"
                      : "border-transparent text-text-faint hover:text-text-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
          footer={
            <>
              {isEdit ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction("delete")}
                  disabled={deleting}
                  title="Eliminar propiedad"
                  aria-label="Eliminar propiedad"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity active:opacity-80 disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-terra/30 border-t-terra" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  )}
                </button>
              ) : (
                <div />
              )}
              <div className="flex min-w-0 items-center gap-2">
                {isEdit && editProperty && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = editProperty;
                      handleClose();
                      setWizardProperty(p);
                    }}
                    title={editProperty.mlPublication?.published ? "Gestionar en ML" : "Publicar en ML"}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-sand-chip px-3 text-[12.5px] font-bold text-warning transition-opacity active:opacity-80"
                  >
                    <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span className="hidden sm:inline">{editProperty.mlPublication?.published ? "Gestionar en ML" : "Publicar en ML"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="shrink-0 px-3 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                >
                  Cancelar
                </button>
                {isEdit ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction("save")}
                    disabled={loading}
                    className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark-fg/30 border-t-dark-fg" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar cambios"
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="property-form"
                    disabled={loading}
                    className="flex items-center gap-2 h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark-fg/30 border-t-dark-fg" />
                        Guardando...
                      </>
                    ) : (
                      "Crear propiedad"
                    )}
                  </button>
                )}
              </div>
            </>
          }
        >
              {/* Body con pestañas (el scroll y padding los da <Sheet>) */}
              <div className="sm:px-3">
                {/* El form envuelve Datos + Ubicación; las pestañas ocultas quedan
                    montadas (hidden) para que FormData conserve todos los campos. */}
                <form
                  id="property-form"
                  onSubmit={handleSubmit}
                  className={modalTab === "datos" || modalTab === "ubicacion" ? "" : "hidden"}
                >
                  {/* ================= Pestaña DATOS ================= */}
                  <div className={modalTab === "datos" ? "space-y-7" : "hidden"}>
                    <section>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Identificación</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={MODAL_LABEL}>Dirección *</label>
                          <input name="address" required defaultValue={editProperty?.address ?? ""} placeholder="Av. Corrientes 1234, 5to A" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Dirección real</label>
                          <input name="realAddress" defaultValue={editProperty?.realAddress ?? ""} placeholder="Brown 1082 - 2B" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Título publicación</label>
                          <input name="publicationTitle" defaultValue={editProperty?.publicationTitle ?? ""} placeholder="Título de aviso" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Código referencia</label>
                          <input name="referenceCode" defaultValue={editProperty?.referenceCode ?? ""} placeholder="Ej: ZP-M-51545814" className={MODAL_FIELD} />
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Características</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className={MODAL_LABEL}>Tipo</label>
                          <SelectField name="type" defaultValue={editProperty?.type ?? ""}>
                            {PROPERTY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Estado</label>
                          <SelectField name="status" defaultValue={editProperty?.status ?? "activa"}>
                            {PROPERTY_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Ambientes</label>
                          <input name="roomAmount" type="number" min={0} defaultValue={editProperty?.roomAmount ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Dormitorios</label>
                          <input name="bedrooms" type="number" min={0} defaultValue={editProperty?.bedrooms ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Baños</label>
                          <input name="bathroomAmount" type="number" min={0} defaultValue={editProperty?.bathroomAmount ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Cocheras</label>
                          <input name="parkingLotAmount" type="number" min={0} defaultValue={editProperty?.parkingLotAmount ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Sup. total (m²)</label>
                          <input name="totalSurface" type="number" min={0} step="0.01" defaultValue={editProperty?.totalSurface ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Sup. cubierta (m²)</label>
                          <input name="roofedSurface" type="number" min={0} step="0.01" defaultValue={editProperty?.roofedSurface ?? ""} className={MODAL_FIELD} />
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Operación</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className={MODAL_LABEL}>Operación</label>
                          <SelectField name="operationType" defaultValue={editProperty?.operationType ?? ""}>
                            <option value="">Sin especificar</option>
                            <option value="Venta">Venta</option>
                            <option value="Alquiler">Alquiler</option>
                          </SelectField>
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Moneda</label>
                          <SelectField name="operationCurrency" defaultValue={editProperty?.operationCurrency ?? ""}>
                            <option value="">Sin especificar</option>
                            <option value="USD">USD</option>
                            <option value="ARS">ARS</option>
                          </SelectField>
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Precio</label>
                          <input name="operationPrice" type="number" min={0} step="0.01" defaultValue={editProperty?.operationPrice ?? ""} className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>URL pública</label>
                          <input name="publicUrl" defaultValue={editProperty?.publicUrl ?? ""} placeholder="https://..." className={MODAL_FIELD} />
                        </div>
                      </div>
                    </section>

                    {/* Responsables internos: quiénes reciben las consultas de esta
                        propiedad (todos los portales). Guarda al instante. */}
                    {isEdit && respUsers.length > 0 && (
                      <section>
                        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">
                          Responsables internos{respSaving ? " · guardando…" : ""}
                        </h3>
                        <p className="mb-2 text-[12px] text-text-faint">
                          Las consultas de esta propiedad les llegan sólo a ellos. Sin responsables, notifica a todos.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {respUsers.map((u) => {
                            const on = respAssigned.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => void toggleResponsible(u.id)}
                                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                  on
                                    ? "bg-dark text-dark-fg"
                                    : "border border-border bg-surface text-text-muted hover:bg-bg"
                                }`}
                              >
                                {on ? "✓ " : ""}
                                {u.fullName?.trim() || u.email}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>

                  {/* ================= Pestaña UBICACIÓN ================= */}
                  <div className={modalTab === "ubicacion" ? "space-y-7" : "hidden"}>
                    <section>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Zona</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className={MODAL_LABEL}>Provincia</label>
                          <input name="province" defaultValue={editProperty?.province ?? ""} placeholder="Buenos Aires" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Ciudad / Partido</label>
                          <input name="city" defaultValue={editProperty?.city ?? ""} placeholder="Quilmes" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Barrio / Zona</label>
                          <input name="zone" defaultValue={editProperty?.zone ?? ""} placeholder="Ezpeleta" className={MODAL_FIELD} />
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Coordenadas</h3>
                      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                        <div>
                          <label className={MODAL_LABEL}>Latitud</label>
                          <input name="geoLat" type="number" step="any" defaultValue={editProperty?.geoLat ?? ""} placeholder="-34.6037" className={MODAL_FIELD} />
                        </div>
                        <div>
                          <label className={MODAL_LABEL}>Longitud</label>
                          <input name="geoLong" type="number" step="any" defaultValue={editProperty?.geoLong ?? ""} placeholder="-58.3816" className={MODAL_FIELD} />
                        </div>
                      </div>
                      <p className="mt-2 text-[12px] text-text-faint">Se usan para el mapa y para vincular avisos de portales por cercanía.</p>
                    </section>
                  </div>

                  {error && (
                    <p className="mt-4 rounded-[14px] bg-clay-chip px-3.5 py-2 text-[13px] font-semibold text-terra">{error}</p>
                  )}
                </form>

                {/* ================= Pestaña FOTOS ================= */}
                {isEdit && (
                  <div className={modalTab === "fotos" ? "" : "hidden"}>
                    {/* Subir / borrar / reordenar / portada. Cada cambio devuelve la
                        galería actualizada; la portada nueva se refleja en el listado. */}
                    <PhotosEditor
                      propertyId={editProperty.id}
                      photos={modalPhotos}
                      loading={photosLoading}
                      active={modalOpen && modalTab === "fotos"}
                      onChange={(photos, cover) => {
                        setModalPhotos(photos);
                        setEditProperty((prev) => (prev ? { ...prev, coverImageUrl: cover } : prev));
                        router.refresh();
                      }}
                    />
                  </div>
                )}


                {/* ================= Pestaña PORTALES ================= */}
                {isEdit && editProperty?.id && (
                  <div className={modalTab === "portales" ? "space-y-4" : "hidden"}>
                    <PortalesPanel propertyId={editProperty.id} />

                    {editProperty?.mlPublication?.published && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-sand-chip/40 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MlChip status={editProperty.mlPublication.status} permalink={null} />
                          <span className="text-xs text-text-muted">Publicado en MercadoLibre</span>
                        </div>
                        {editProperty.mlPublication.permalink && (
                          <div className="flex items-center gap-2">
                            <a
                              href={editProperty.mlPublication.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg"
                            >
                              Ver aviso
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 17L17 7" />
                                <path d="M7 7h10v10" />
                              </svg>
                            </a>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(editProperty.mlPublication!.permalink!);
                                  toast.success("Link copiado");
                                } catch {
                                  toast.error("No se pudo copiar");
                                }
                              }}
                              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                              Copiar link
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
        </Sheet>
      )}

      {/* Modal de confirmación — Guardar / Eliminar */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              key="confirm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-scrim backdrop-blur-sm"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              key="confirm-dialog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
            >
              <p className="font-display text-[17px] font-semibold text-text">
                {confirmAction === "delete" ? "¿Eliminar propiedad?" : "¿Guardar cambios?"}
              </p>
              <p className="mt-1 text-[13px] text-text-muted">
                {confirmAction === "delete"
                  ? "Esta acción no se puede deshacer."
                  : "Se guardarán los cambios realizados en la propiedad."}
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                >
                  Cancelar
                </button>
                {confirmAction === "delete" ? (
                  <button
                    type="button"
                    onClick={() => { setConfirmAction(null); handleDelete(); }}
                    className="h-10 rounded-full bg-terra px-5 text-[13px] font-bold text-white transition-opacity active:opacity-90"
                  >
                    Eliminar
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="property-form"
                    onClick={() => setConfirmAction(null)}
                    className="h-10 rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity active:opacity-90"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {assignModalOpen && isAdmin && (
        <Sheet
          open={assignModalOpen && isAdmin}
          onClose={() => setAssignModalOpen(false)}
          title="Asignar seguimiento"
          maxWidth="sm:max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="assign-form"
                disabled={assigning}
                className="h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
              >
                {assigning ? "Asignando..." : "Asignar seguimiento"}
              </button>
            </>
          }
        >
              <form id="assign-form" onSubmit={handleAssignFollowUp} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Propiedad *</label>
                    <SelectField name="propertyId" required>
                      <option value="">Seleccionar...</option>
                      {propertiesForAssignments.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.address}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Asignado a *</label>
                    <SelectField name="assignedToUserId" required>
                      <option value="">Seleccionar...</option>
                      {usersForAssignments.map((user) => (
                        <option key={user.id} value={user.id}>
                          {getUserLabel(user)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Título</label>
                    <input
                      name="title"
                      placeholder="Ej: Seguimiento comercial"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Vencimiento</label>
                    <DatePicker
                      name="dueDate"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Notas</label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Indicaciones para el seguimiento..."
                    className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                  />
                </div>
              </form>
        </Sheet>
      )}

      {/* Owner report modal */}
      <Sheet
        open={!!ownerModalProperty}
        onClose={() => setOwnerModalProperty(null)}
        title="Informe para propietario"
        maxWidth="sm:max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setOwnerModalProperty(null)} className="px-4 py-2 text-[13px] font-semibold text-text-faint active:text-text">
              Cancelar
            </button>
            <button
              onClick={handleOwnerSubmit}
              disabled={ownerSaving}
              className="flex items-center gap-2 h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
            >
              {ownerSaving ? "Generando..." : "Guardar y generar PDF"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            {ownerModalProperty?.address}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Visitas totales</label>
              <input
                type="number"
                min={0}
                value={ownerForm.visitasTotales}
                onChange={(e) => setOwnerForm((f) => ({ ...f, visitasTotales: e.target.value }))}
                placeholder="0"
                className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Visitas este mes</label>
              <input
                type="number"
                min={0}
                value={ownerForm.visitasMes}
                onChange={(e) => setOwnerForm((f) => ({ ...f, visitasMes: e.target.value }))}
                placeholder="0"
                className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Quejas / Observaciones</label>
            <textarea
              rows={4}
              value={ownerForm.quejas}
              onChange={(e) => setOwnerForm((f) => ({ ...f, quejas: e.target.value }))}
              placeholder="Quejas o comentarios del propietario..."
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Mejoras / Sugerencias</label>
            <textarea
              rows={4}
              value={ownerForm.mejoras}
              onChange={(e) => setOwnerForm((f) => ({ ...f, mejoras: e.target.value }))}
              placeholder="Sugerencias de mejora para la propiedad..."
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
        </div>
      </Sheet>

      {wizardProperty && (
        <MlPublishWizard
          propertyId={wizardProperty.id}
          propertyLabel={wizardProperty.publicationTitle ?? wizardProperty.address}
          onClose={() => setWizardProperty(null)}
          onPublished={() => router.refresh()}
        />
      )}
    </div>
  );
}
