"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTACT, WEB_BASE } from "@/lib/web/format";
import { AccountButton } from "./account-button";
import { FavoritesLink } from "./favorites";
import { IconClose, IconMenu, IconPhone, IconSearch } from "./icons";
import { useModal } from "./use-modal";

const NAV = [
  { href: `${WEB_BASE}/propiedades?op=venta`, label: "Comprar" },
  { href: `${WEB_BASE}/propiedades?op=alquiler`, label: "Alquilar" },
  { href: `${WEB_BASE}#emprendimientos`, label: "Emprendimientos" },
  { href: `${WEB_BASE}#tasaciones`, label: "Tasaciones" },
  { href: `${WEB_BASE}#contacto`, label: "Contacto" },
];

export function Header() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useModal(dialog, open);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [pathname]);

  const close = () => setOpen(false);

  return (
    <header className="jw-header">
      <div className="jw-header-row">
        <Link href={WEB_BASE} className="jw-logo" aria-label="Juliana Profitos Propiedades, inicio">
          <Image src="/web/logo.png" alt="" width={64} height={38} priority />
        </Link>
        <nav className="jw-nav" aria-label="Principal">
          {NAV.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <form className="jw-quick" action={`${WEB_BASE}/propiedades`} role="search">
          <IconSearch width={16} height={16} />
          <input name="q" type="search" enterKeyHint="search" placeholder="Calle o código" aria-label="Buscar por calle o código" />
        </form>
        <a className="jw-phone" href={CONTACT.phoneHref}>
          <IconPhone width={16} height={16} /> {CONTACT.phoneDisplay}
        </a>
        <FavoritesLink />
        <AccountButton />
        <button type="button" className="jw-menu" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>
          <IconMenu />
        </button>
      </div>
      <dialog
        ref={dialog}
        className="jw-drawer"
        aria-label="Menú"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        {open && (
          <div tabIndex={-1} autoFocus data-jw-autofocus className="jw-drawer-frame">
            <button type="button" className="jw-icon-btn jw-drawer-close" aria-label="Cerrar menú" onClick={close}><IconClose /></button>
            <nav aria-label="Menú principal">
              {NAV.map((item) => <Link key={item.href} href={item.href} onClick={close}>{item.label}</Link>)}
            </nav>
            <form action={`${WEB_BASE}/propiedades`} role="search" className="jw-drawer-search" onSubmit={close}>
              <input name="q" type="search" enterKeyHint="search" placeholder="Buscar por calle o código" aria-label="Buscar por calle o código" />
              <button type="submit" aria-label="Buscar"><IconSearch /></button>
            </form>
            <a className="jw-drawer-phone" href={CONTACT.phoneHref}><IconPhone /> {CONTACT.phoneDisplay}</a>
          </div>
        )}
      </dialog>
    </header>
  );
}
