"use client";

import { useState, type FormEvent } from "react";
import { whatsappUrl } from "@/lib/web/format";
import { IconWhatsapp } from "./icons";

/**
 * Arma el mensaje y abre WhatsApp. No guarda nada todavía: cuando las consultas
 * entren a Contactos y Tasaciones de Profitos, este envío pasa a la API.
 */
export function WhatsappForm({ intro, detailLabel, detailPlaceholder, cta, defaultDetail = "" }: { intro: string; detailLabel: string; detailPlaceholder: string; cta: string; defaultDetail?: string }) {
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("nombre") ?? "").trim();
    const detail = String(data.get("detalle") ?? "").trim();
    if (!name || !detail) {
      setError("Completá tu nombre y el mensaje para poder enviarlo.");
      return;
    }
    setError(null);
    window.open(whatsappUrl(`${intro}\nNombre: ${name}\n${detailLabel}: ${detail}`), "_blank", "noopener");
  }

  return (
    <form className="jw-form" onSubmit={onSubmit} noValidate>
      <label>
        <span>Nombre</span>
        <input name="nombre" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required />
      </label>
      <label>
        <span>{detailLabel}</span>
        <textarea name="detalle" rows={4} placeholder={detailPlaceholder} defaultValue={defaultDetail} required />
      </label>
      {error && <p className="jw-form-error" role="alert">{error}</p>}
      <button type="submit" className="jw-btn jw-btn-primary"><IconWhatsapp /> {cta}</button>
    </form>
  );
}
