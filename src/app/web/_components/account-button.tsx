"use client";

import { useEffect, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element -- foto de perfil de Google, ya chica y de dominio variable */
import { useAccount } from "./account";
import { IconPerson } from "./icons";

export function AccountButton() {
  const { enabled, visitor, openLogin, openPhone, logout } = useAccount();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!enabled) return null;
  if (!visitor) {
    return (
      <button type="button" className="jw-account" aria-label="Ingresar" onClick={() => openLogin()}>
        <IconPerson />
        <span className="jw-account-label">Ingresar</span>
      </button>
    );
  }
  return (
    <div className="jw-account-wrap" ref={wrap}>
      <button type="button" className="jw-account" aria-label={`Tu cuenta: ${visitor.name ?? visitor.email}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {visitor.picture ? <img src={visitor.picture} alt="" width={28} height={28} referrerPolicy="no-referrer" /> : <IconPerson />}
      </button>
      {open && (
        <div className="jw-account-menu">
          <p><strong>{visitor.name ?? "Tu cuenta"}</strong><span>{visitor.email}</span></p>
          {!visitor.hasPhone && <button type="button" onClick={() => { setOpen(false); openPhone(); }}>Agregar celular</button>}
          <button type="button" onClick={() => { setOpen(false); logout(); }}>Salir</button>
        </div>
      )}
    </div>
  );
}
