"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Lleva la foto de la tarjeta a la galería de la ficha con la View Transitions
 * API. Sin soporte, con "reducir movimiento" o con ctrl/cmd + clic, es un link
 * común. La espera tiene tope para que una red lenta no congele la pantalla.
 */
export function TransitionLink({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLAnchorElement>(null);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (!("startViewTransition" in document)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    const photo = ref.current?.querySelector<HTMLElement>("img");
    if (photo) photo.style.viewTransitionName = "jw-photo";
    document.startViewTransition(async () => {
      if (photo) photo.style.viewTransitionName = "";
      router.push(href);
      const started = Date.now();
      while (window.location.pathname === pathname || !document.querySelector("[data-jw-photo]")) {
        if (Date.now() - started > 1200) break;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    });
  }

  return (
    <Link ref={ref} href={href} className={className} onClick={onClick} aria-label={label}>
      {children}
    </Link>
  );
}
