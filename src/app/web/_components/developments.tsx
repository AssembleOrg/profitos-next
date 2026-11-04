"use client";

import { useState } from "react";
import Image from "next/image";
import { deliveryLabel, type Development } from "@/lib/web/developments";
import { whatsappUrl } from "@/lib/web/format";
import { IconArrow } from "./icons";

/** La lista de edificios maneja la imagen grande: al pasar o enfocar, cambia sin saltos. */
export function Developments({ items }: { items: Development[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="jw-devs">
      <div className="jw-devs-stage" aria-hidden="true">
        {items.map((item, index) => (
          <div key={item.name} className="jw-devs-photo" data-active={index === active}>
            <Image src={item.image} alt="" fill sizes="(max-width: 900px) 1px, 55vw" />
          </div>
        ))}
      </div>
      <ul className="jw-devs-list">
        {items.map((item, index) => (
          <li key={item.name} data-active={index === active}>
            <a
              href={whatsappUrl(`Hola, quiero consultar por el emprendimiento ${item.name} (${item.address}).`)}
              target="_blank"
              rel="noreferrer"
              data-track-label={item.name}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
            >
              <span className="jw-devs-mobile-photo">
                <Image src={item.image} alt="" fill sizes="(max-width: 900px) 100vw, 1px" />
              </span>
              <span className="jw-devs-name">{item.name}</span>
              <span className="jw-devs-where">{[`${item.address}, ${item.zone}`, deliveryLabel(item)].filter(Boolean).join(" · ")}</span>
              <span className="jw-devs-more">
                <span className="jw-devs-more-inner">
                  <span className="jw-devs-summary">{item.summary}</span>
                  <span className="jw-devs-cta">Consultar por WhatsApp <IconArrow width={16} height={16} /></span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
