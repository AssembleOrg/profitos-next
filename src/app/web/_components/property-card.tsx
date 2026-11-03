import Image from "next/image";
import type { PublicGroup } from "@/lib/web/catalog";
import { formatPrice, OPERATION_LABEL } from "@/lib/web/format";
import { FavoriteButton } from "./favorites";
import { TransitionLink } from "./transition-link";

export function PropertyCard({ group, large = false, priority = false, hideTag = false }: { group: PublicGroup; large?: boolean; priority?: boolean; hideTag?: boolean }) {
  const { lead, title, units, fromPrice } = group;
  const price = units > 1 && fromPrice ? `Desde ${formatPrice(fromPrice, lead.currency)}` : formatPrice(lead.price, lead.currency);
  const facts = [
    lead.surface ? `${Math.round(lead.surface)} m²` : null,
    lead.rooms ? `${lead.rooms} amb.` : null,
    lead.bedrooms ? `${lead.bedrooms} dorm.` : null,
    lead.bathrooms ? `${lead.bathrooms} ${lead.bathrooms === 1 ? "baño" : "baños"}` : null,
  ].filter(Boolean).slice(0, 3);
  const name = `${lead.type} en ${title}`;

  return (
    <article className="jw-card" data-large={large}>
      <div className="jw-card-media">
        <TransitionLink href={lead.href} label={name}>
          {lead.coverLarge ? (
            <Image
              src={lead.coverLarge}
              alt=""
              fill
              priority={priority}
              sizes={large ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"}
            />
          ) : (
            <span className="jw-card-nophoto">Foto a confirmar</span>
          )}
        </TransitionLink>
        {!hideTag && <span className="jw-tag" data-op={lead.operation}>{OPERATION_LABEL[lead.operation]}</span>}
        <FavoriteButton propertyKey={lead.key} label={lead.address} />
        {units > 1 && <span className="jw-units">{units} unidades</span>}
      </div>
      <div className="jw-card-body">
        <p className="jw-card-price">{price}</p>
        <h3 className="jw-card-title">
          <TransitionLink href={lead.href}>{title}</TransitionLink>
        </h3>
        <p className="jw-card-meta">{lead.type} en {lead.zone}</p>
        {facts.length > 0 && <p className="jw-card-facts">{facts.join("  ·  ")}</p>}
      </div>
    </article>
  );
}
