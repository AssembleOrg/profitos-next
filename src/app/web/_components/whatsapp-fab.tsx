"use client";

import { useEffect, useState } from "react";
import { whatsappUrl } from "@/lib/web/format";
import { IconWhatsapp } from "./icons";

/** En el celular aparece al bajar: la primera pantalla ya tiene el buscador y no debe taparlo. */
export function WhatsappFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 320 || window.matchMedia("(min-width: 901px)").matches);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <a className="jw-wa" data-visible={visible} tabIndex={visible ? undefined : -1} href={whatsappUrl("Hola, quiero hacer una consulta.")} target="_blank" rel="noreferrer" aria-label="Escribinos por WhatsApp">
      <IconWhatsapp width={26} height={26} />
    </a>
  );
}
