"use client";

import { useEffect, useRef, useState } from "react";

const NUMBER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const DURATION = 900;

/**
 * Cuenta hasta el valor real cuando entra en pantalla; si el valor cambia
 * (otro filtro), cuenta desde el anterior. El HTML del servidor ya trae el
 * número final, y el lector de pantalla siempre lee ese, no la animación.
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const seen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const set = (n: number) => {
      current.current = n;
      setShown(n);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => set(value));
      return () => cancelAnimationFrame(frame);
    }
    const run = (from: number) => {
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION);
        set(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    if (seen.current) {
      run(current.current);
      return () => cancelAnimationFrame(frame);
    }
    // Fuera de pantalla queda en 0 hasta que se vea; así nunca se ve el final y después el salto a 0.
    frame = requestAnimationFrame(() => set(0));
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        seen.current = true;
        cancelAnimationFrame(frame);
        run(0);
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className="jw-count">
      <span aria-hidden="true">{NUMBER.format(shown)}{suffix}</span>
      <span className="jw-sr">{NUMBER.format(value)}{suffix}</span>
    </span>
  );
}
