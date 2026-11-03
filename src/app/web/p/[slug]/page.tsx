import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getPropertyByKey, groupUnits } from "@/lib/web/catalog";
import { CONTACT, formatPrice, OPERATION_LABEL, WEB_BASE, whatsappUrl } from "@/lib/web/format";
import { FavoriteButton } from "../../_components/favorites";
import { Gallery } from "../../_components/gallery";
import { IconBack, IconPhone, IconWhatsapp } from "../../_components/icons";
import { PropertyCard } from "../../_components/property-card";
import { VideoPlayer } from "../../_components/video-player";
import { ZoneMap } from "../../_components/zone-map";
import { WhatsappForm } from "../../_components/whatsapp-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const { slug } = await params;
  return getPropertyByKey(decodeURIComponent(slug).split("-")[0]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = await load(params);
  if (!property) return { title: "Propiedad no encontrada" };
  const title = `${property.type} en ${OPERATION_LABEL[property.operation].toLowerCase()} en ${property.zone}, ${property.address}`;
  const description = (property.description ?? title).replace(/\s+/g, " ").slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: property.href },
    openGraph: { title, description, images: property.coverLarge ? [property.coverLarge] : [] },
  };
}

export default async function WebProperty({ params }: Props) {
  const property = await load(params);
  if (!property) notFound();

  const catalog = await getCatalog();
  const groups = groupUnits(catalog);
  const ownGroup = groups.find((group) => group.members.some((item) => item.id === property.id));
  const sameBuilding = ownGroup?.members.filter((item) => item.id !== property.id) ?? [];
  const similar = groups
    .filter((group) => group !== ownGroup && group.lead.operation === property.operation && group.lead.type === property.type)
    .slice(0, 3);

  const facts = [
    property.surface ? { label: "Superficie total", value: `${Math.round(property.surface)} m²` } : null,
    property.roofedSurface ? { label: "Cubierta", value: `${Math.round(property.roofedSurface)} m²` } : null,
    property.rooms ? { label: "Ambientes", value: String(property.rooms) } : null,
    property.bedrooms ? { label: "Dormitorios", value: String(property.bedrooms) } : null,
    property.bathrooms ? { label: "Baños", value: String(property.bathrooms) } : null,
    property.parking ? { label: "Cocheras", value: String(property.parking) } : null,
    property.age !== null && property.age >= 0 ? { label: "Antigüedad", value: property.age === 0 ? "A estrenar" : `${property.age} años` } : null,
    property.orientation ? { label: "Orientación", value: property.orientation } : null,
    property.disposition ? { label: "Disposición", value: property.disposition } : null,
    property.expenses ? { label: "Expensas", value: formatPrice(property.expenses, "ARS") } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  const consult = `Hola, quiero consultar por ${property.type.toLowerCase()} en ${property.address}${property.reference ? ` (${property.reference})` : ""}.`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${property.type} en ${property.address}`,
    description: property.description ?? undefined,
    image: property.photos.slice(0, 6).map((photo) => photo.src),
    address: { "@type": "PostalAddress", streetAddress: property.address, addressLocality: property.zone, addressCountry: "AR" },
    ...(property.price ? { offers: { "@type": "Offer", price: property.price, priceCurrency: /usd|u\$s/i.test(property.currency ?? "") ? "USD" : "ARS" } } : {}),
  };

  return (
    <div className="jw-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <div className="jw-wrap">
        <Link className="jw-back" href={`${WEB_BASE}/propiedades?op=${property.operation === "venta" ? "venta" : "alquiler"}`}>
          <IconBack width={16} height={16} /> Ver propiedades
        </Link>
        <Gallery photos={property.photos} />

        <div className="jw-detail-grid">
          <div className="jw-detail-main">
            <header className="jw-detail-head">
              <h1>{property.address}</h1>
              <p>{property.type} en {OPERATION_LABEL[property.operation].toLowerCase()} en {property.zone}</p>
              <p className="jw-detail-price">{formatPrice(property.price, property.currency)}</p>
            </header>

            {facts.length > 0 && (
              <dl className="jw-facts">
                {facts.map((fact) => (
                  <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                ))}
              </dl>
            )}

            {property.description && (
              <section className="jw-prose">
                <h2>Descripción</h2>
                {property.description.split(/\n{2,}/).map((block) => <p key={block.slice(0, 40)}>{block}</p>)}
              </section>
            )}

            {property.features.length > 0 && (
              <section>
                <h2>Características</h2>
                <ul className="jw-features">{property.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              </section>
            )}

            {property.videos[0] && (
              <section>
                <h2>Video</h2>
                <VideoPlayer id={property.videos[0]} title={`Video de ${property.address}`} />
              </section>
            )}

            {property.lat !== null && property.lng !== null && (
              <section>
                <h2>Ubicación aproximada</h2>
                <ZoneMap lat={property.lat} lng={property.lng} title={`Mapa de la zona de ${property.address}, ${property.zone}`} />
              </section>
            )}
          </div>

          <aside className="jw-contact" aria-label="Consultar por esta propiedad">
            <div className="jw-contact-box">
              <div className="jw-contact-top">
                <h2>Consultá por esta propiedad</h2>
                <FavoriteButton propertyKey={property.key} label={property.address} />
              </div>
              <a className="jw-btn jw-btn-wa" href={whatsappUrl(consult)} target="_blank" rel="noreferrer"><IconWhatsapp /> Escribir por WhatsApp</a>
              <a className="jw-btn jw-btn-ghost" href={CONTACT.phoneHref}><IconPhone /> Llamar al {CONTACT.phoneDisplay}</a>
              <details className="jw-contact-form">
                <summary>Dejar un mensaje</summary>
                <WhatsappForm intro={consult} detailLabel="Mensaje" detailPlaceholder="¿Qué te gustaría saber?" cta="Enviar por WhatsApp" />
              </details>
              {property.reference && <p className="jw-ref">Código {property.reference}</p>}
            </div>
          </aside>
        </div>

        {sameBuilding.length > 0 && (
          <section className="jw-section">
            <div className="jw-section-head"><h2>Otras unidades del edificio</h2></div>
            <ul className="jw-units-list">
              {sameBuilding.slice(0, 10).map((unit) => (
                <li key={unit.id}>
                  <Link href={unit.href}>
                    <strong>{unit.address}</strong>
                    <span>{[unit.surface ? `${Math.round(unit.surface)} m²` : null, unit.rooms ? `${unit.rooms} amb.` : null].filter(Boolean).join(" · ")}</span>
                    <b>{formatPrice(unit.price, unit.currency)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {similar.length > 0 && (
          <section className="jw-section">
            <div className="jw-section-head"><h2>También te puede interesar</h2></div>
            <div className="jw-grid">{similar.map((group) => <PropertyCard key={group.lead.id} group={group} />)}</div>
          </section>
        )}
      </div>

      <div className="jw-stickybar">
        <div>
          <strong>{formatPrice(property.price, property.currency)}</strong>
          <span>{property.address}</span>
        </div>
        <a className="jw-btn jw-btn-wa" href={whatsappUrl(consult)} target="_blank" rel="noreferrer"><IconWhatsapp /> Consultar</a>
      </div>
    </div>
  );
}
