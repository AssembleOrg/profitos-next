import Image from "next/image";
import Link from "next/link";
import { catalogOptions, getCatalog, groupUnits } from "@/lib/web/catalog";
import { DEVELOPMENTS } from "@/lib/web/developments";
import { CONTACT, WEB_BASE } from "@/lib/web/format";
import { CountUp } from "./_components/count-up";
import { Developments } from "./_components/developments";
import { HeroSlides, type HeroSlide } from "./_components/hero-slides";
import { IconArrow } from "./_components/icons";
import { PropertyCard } from "./_components/property-card";
import { SearchPanel } from "./_components/search-panel";
import { WhatsappForm } from "./_components/whatsapp-form";

export const dynamic = "force-dynamic";

export default async function WebHome() {
  const catalog = await getCatalog();
  const options = catalogOptions(catalog);
  const groups = groupUnits(catalog);
  // Las que el equipo marcó como destacadas; si faltan, se completa con las últimas en venta.
  const onSale = groups.filter((group) => group.lead.operation === "venta" && group.lead.coverLarge);
  const isHome = (group: (typeof onSale)[number]) => ["Departamento", "Casa", "PH"].includes(group.lead.type);
  const starred = onSale.filter((group) => group.members.some((item) => item.starred));
  const pool = [...starred, ...onSale.filter((group) => !starred.includes(group))];
  const first = pool.find(isHome);
  const featured = (first ? [first, ...pool.filter((group) => group !== first)] : pool).slice(0, 6);
  // Las fotos de los avisos varían mucho en calidad; la portada usa los edificios propios.
  const slides: HeroSlide[] = DEVELOPMENTS.filter((item) => ["Anton 7", "Lavalle & Solís · Anton", "San Martín 870"].includes(item.name)).map((item) => ({
    src: item.image,
    href: `${WEB_BASE}#emprendimientos`,
    title: item.name,
    caption: `${item.address}, ${item.zone}${item.illustrative ? " · Imagen ilustrativa" : ""}`,
  }));
  const [lead, ...others] = featured;
  const onSaleCount = catalog.filter((item) => item.operation === "venta").length;

  return (
    <>
      <section className="jw-hero">
        <HeroSlides slides={slides} />
        <div className="jw-hero-copy">
          <h1>Encontrá tu propiedad en Quilmes y zona sur</h1>
          <SearchPanel types={options.types.map(([type]) => type)} zones={options.zones.map(([zone]) => zone)} />
        </div>
      </section>

      <nav className="jw-types" aria-label="Propiedades por tipo">
        <div className="jw-wrap">
          {options.types.slice(0, 7).map(([type, count]) => (
            <Link key={type} href={`${WEB_BASE}/propiedades?tipo=${encodeURIComponent(type)}`}>
              <strong>{type}</strong>
              <span><CountUp value={count} /></span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Solo cifras que salen del catálogo publicado: nada estimado ni redondeado para arriba. */}
      <section className="jw-stats jw-wrap" aria-label="La inmobiliaria en números">
        <dl>
          <div><dt>Propiedades publicadas</dt><dd><CountUp value={catalog.length} /></dd></div>
          <div><dt>En venta</dt><dd><CountUp value={onSaleCount} /></dd></div>
          <div><dt>En alquiler</dt><dd><CountUp value={catalog.length - onSaleCount} /></dd></div>
          <div><dt>Emprendimientos</dt><dd><CountUp value={DEVELOPMENTS.length} /></dd></div>
        </dl>
        <p>Propiedades en {options.zones.length} {options.zones.length === 1 ? "zona" : "zonas"} · Matrícula {CONTACT.license} · {CONTACT.address}</p>
      </section>

      {lead && (
        <section className="jw-section jw-wrap">
          <div className="jw-section-head">
            <h2>{starred.length >= 6 ? "Propiedades destacadas" : "Propiedades en venta"}</h2>
            <Link className="jw-link" href={`${WEB_BASE}/propiedades?op=venta`}>Ver todas <IconArrow width={16} height={16} /></Link>
          </div>
          <div className="jw-featured">
            <PropertyCard group={lead} large />
            {others.map((group) => <PropertyCard key={group.lead.id} group={group} />)}
          </div>
        </section>
      )}

      <section className="jw-dark" id="emprendimientos">
        <div className="jw-wrap">
          <div className="jw-section-head">
            <h2>Emprendimientos</h2>
          </div>
          <Developments items={DEVELOPMENTS} />
        </div>
      </section>

      <section className="jw-section jw-wrap jw-split" id="tasaciones">
        <div className="jw-split-photo">
          <Image src="/web/emprendimientos/lavalle-solis.jpg" alt="Edificio en Lavalle 1102, Quilmes" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <div className="jw-split-copy">
          <h2>¿Querés vender o alquilar tu propiedad?</h2>
          <p>Contanos qué propiedad tenés y te respondemos para coordinar la tasación. También podés acercarte a {CONTACT.address}.</p>
          <WhatsappForm
            intro="Hola, quiero pedir una tasación."
            detailLabel="Propiedad"
            detailPlaceholder="Dirección, tipo de propiedad y ambientes"
            cta="Pedir tasación"
          />
        </div>
      </section>
    </>
  );
}
