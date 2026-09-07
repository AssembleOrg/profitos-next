"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca la UI cuando el chat IA ejecuta una acción que modifica datos.
 *
 * El widget de rag-webchat corre inline en esta misma ventana y, cuando una tool
 * que NO es GET se ejecuta con éxito, emite `window` → CustomEvent('profitos:accion').
 * Acá lo escuchamos y hacemos `router.refresh()` (re-fetch de los Server
 * Components de la ruta actual) para que agenda, listados, seguimientos, etc. se
 * actualicen sin que el usuario recargue la página.
 *
 * Se debouncea para agrupar varias acciones seguidas en un solo refresh.
 */
export function ChatActionRefresher() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onAccion = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 350);
    };

    window.addEventListener("profitos:accion", onAccion as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("profitos:accion", onAccion as EventListener);
    };
  }, [router]);

  return null;
}
