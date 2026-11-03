"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type HeroSlide = { src: string; href: string; title: string; caption: string };

/** Crossfade lento entre edificios reales. Se detiene con "reducir movimiento". */
export function HeroSlides({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const current = slides[active];
  return (
    <>
      <div className="jw-hero-photos" aria-hidden="true">
        {slides.map((slide, index) => (
          <div key={slide.src} className="jw-hero-photo" data-active={index === active}>
            <Image src={slide.src} alt="" fill priority={index === 0} sizes="100vw" />
          </div>
        ))}
      </div>
      {current && (
        <Link key={current.href} href={current.href} className="jw-hero-caption">
          <strong>{current.title}</strong>
          <span>{current.caption}</span>
        </Link>
      )}
    </>
  );
}
