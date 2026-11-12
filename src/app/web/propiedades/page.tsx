import type { Metadata } from "next";
import Link from "next/link";
import { catalogOptions, filterCatalog, getCatalog, groupUnits, sortCatalog } from "@/lib/web/catalog";
import { WEB_BASE } from "@/lib/web/format";
import { CountUp } from "../_components/count-up";
import { ListingFilters } from "../_components/listing-filters";
import { ListingMap, type MapPin } from "../_components/listing-map";
import { PropertyCard } from "../_components/property-card";
import { TrackSearch } from "../_components/track-search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const KEYS = ["op", "tipo", "zona", "amb", "dorm", "moneda", "min", "max", "sup", "q", "ids", "orden"] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickValues(params: Record<string, string | string[] | undefined>) {
  const values: Record<string, string | undefined> = {};
  for (const key of KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) values[key] = value.trim();
  }
  return values;
}

function heading(values: Record<string, string | undefined>): string {
  if (values.ids) return "Tus favoritas";
  const type = values.tipo ?? "Propiedades";
  const operation = values.op === "venta" ? " en venta" : values.op === "alquiler" ? " en alquiler" : "";
  return `${type}${operation}${values.zona ? ` en ${values.zona}` : ""}`;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  return { title: heading(pickValues(await searchParams)) };
}

export default async function WebListing({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const values = pickValues(params);
  const catalog = await getCatalog();
  const options = catalogOptions(values.op ? catalog.filter((item) => item.operation === values.op) : catalog);
  const results = sortCatalog(filterCatalog(catalog, values), values.orden);
  const groups = groupUnits(results);
  const page = Math.max(1, Number(params.pag) || 1);
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const visible = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onMap = params.vista === "mapa";
  const viewHref = (map: boolean) => {
    const query = new URLSearchParams(values as Record<string, string>);
    if (map) query.set("vista", "mapa");
    const text = query.toString();
    return `${WEB_BASE}/propiedades${text ? `?${text}` : ""}`;
  };
  // En el mapa van todas (sin paginar). Las que no tienen coordenada se listan abajo.
  const pins: MapPin[] = groups
    .filter((group) => group.lead.lat != null && group.lead.lng != null)
    .map((group) => ({
      key: group.lead.key,
      href: group.lead.href,
      title: group.title,
      meta: `${group.lead.type} en ${group.lead.zone}`,
      price: group.lead.price,
      fromPrice: group.units > 1 ? group.fromPrice : null,
      currency: group.lead.currency,
      cover: group.lead.cover,
      lat: group.lead.lat as number,
      lng: group.lead.lng as number,
    }));
  const unplaced = groups.filter((group) => group.lead.lat == null || group.lead.lng == null);
  const pageHref = (target: number) => {
    const query = new URLSearchParams(values as Record<string, string>);
    if (target > 1) query.set("pag", String(target));
    const text = query.toString();
    return `${WEB_BASE}/propiedades${text ? `?${text}` : ""}`;
  };

  return (
    <div className="jw-listing jw-wrap">
      <div className="jw-listing-head">
        <h1>{heading(values)}</h1>
        <p aria-live="polite"><CountUp value={results.length} /> {results.length === 1 ? "resultado" : "resultados"}</p>
        <nav className="jw-seg jw-view" aria-label="Ver como">
          <Link href={viewHref(false)} aria-current={onMap ? undefined : "page"} scroll={false}>Lista</Link>
          <Link href={viewHref(true)} aria-current={onMap ? "page" : undefined} scroll={false}>Mapa</Link>
        </nav>
      </div>
      <TrackSearch values={values} results={results.length} />
      <ListingFilters values={values} types={options.types} zones={options.zones} />
      {onMap && groups.length > 0 ? (
        <>
          <ListingMap pins={pins} />
          {unplaced.length > 0 && (
            <section className="jw-section">
              <div className="jw-section-head"><h2>Sin ubicación en el mapa</h2></div>
              <div className="jw-grid">{unplaced.map((group) => <PropertyCard key={group.lead.id} group={group} hideTag={Boolean(values.op)} />)}</div>
            </section>
          )}
        </>
      ) : visible.length > 0 ? (
        <div className="jw-grid">
          {visible.map((group, index) => <PropertyCard key={group.lead.id} group={group} priority={index < 3} hideTag={Boolean(values.op)} />)}
        </div>
      ) : (
        <div className="jw-empty">
          <h2>{values.ids ? "Todavía no guardaste propiedades" : "No encontramos propiedades con esos filtros"}</h2>
          <p>{values.ids ? "Tocá el corazón de una propiedad para guardarla acá." : "Probá sacando algún filtro o escribinos y te ayudamos a buscar."}</p>
          <Link className="jw-btn jw-btn-primary" href={`${WEB_BASE}/propiedades`}>Ver todas las propiedades</Link>
        </div>
      )}
      {!onMap && pages > 1 && (
        <nav className="jw-pages" aria-label="Páginas">
          {page > 1 && <Link href={pageHref(page - 1)}>Anterior</Link>}
          <span>Página {page} de {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)}>Siguiente</Link>}
        </nav>
      )}
    </div>
  );
}
