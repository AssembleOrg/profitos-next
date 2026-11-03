"use client";

import { useEffect, type RefObject } from "react";

let locks = 0;
let savedY = 0;

/**
 * Safari iOS sigue moviendo la página detrás de un <dialog> modal; `overflow: hidden`
 * en el body no alcanza. Se fija el body y se restaura el scroll al cerrar.
 */
function lockScroll() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const { style } = document.body;
  style.position = "fixed";
  style.top = `-${savedY}px`;
  style.left = "0";
  style.right = "0";
  document.documentElement.style.overflowY = "scroll";
}

function unlockScroll() {
  if (--locks > 0) return;
  const { style } = document.body;
  style.position = "";
  style.top = "";
  style.left = "";
  style.right = "";
  document.documentElement.style.overflowY = "";
  window.scrollTo({ top: savedY, behavior: "instant" });
}

export function useModal(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    lockScroll();

    // El teclado de iOS no achica 100dvh: sin esto, el pie de la hoja queda debajo.
    const viewport = window.visualViewport;
    const fit = () => {
      if (!viewport || viewport.scale > 1.01) return;
      dialog.style.setProperty("--jw-kb", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);

    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      if (dialog.open) dialog.close();
      unlockScroll();
    };
  }, [open, ref]);
}
