"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconArrow, IconBack, IconClose, IconGrid } from "./icons";
import { track as trackEvent } from "./tracker";
import { useModal } from "./use-modal";

type Photo = { src: string; thumb: string; alt: string };

export function Gallery({ photos }: { photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const [index, setIndex] = useState(0);
  const [inlineIndex, setInlineIndex] = useState(0);
  useModal(dialog, open);

  function show(at: number) {
    setStart(at);
    setIndex(at);
    setOpen(true);
    trackEvent("photo_open", { label: String(at + 1) });
  }

  useEffect(() => {
    if (!open) return;
    const element = track.current;
    if (!element) return;
    element.scrollTo({ left: start * element.clientWidth, behavior: "instant" });
    const onScroll = () => setIndex(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [open, start]);

  // La miniatura de la foto actual siempre a la vista en la tira.
  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index, open]);

  function go(delta: number) {
    const element = track.current;
    if (!element) return;
    const next = Math.min(photos.length - 1, Math.max(0, index + delta));
    element.scrollTo({ left: next * element.clientWidth, behavior: "smooth" });
  }

  if (photos.length === 0) return <div className="jw-gallery-empty">Sin fotos publicadas</div>;

  const [first, ...rest] = photos;
  return (
    <>
      <div className="jw-gallery" data-count={Math.min(photos.length, 5)}>
        <button type="button" className="jw-gallery-main" onClick={() => show(0)} aria-label="Ver fotos a pantalla completa">
          <Image data-jw-photo src={first.src} alt={first.alt} fill priority sizes="60vw" style={{ viewTransitionName: "jw-photo" }} />
        </button>
        {rest.slice(0, 4).map((photo, position) => (
          <button key={photo.src} type="button" className="jw-gallery-side" onClick={() => show(position + 1)} aria-label={`Ver foto ${position + 2}`}>
            <Image src={photo.src} alt={photo.alt} fill sizes="20vw" />
          </button>
        ))}
        {photos.length > 1 && (
          <button type="button" className="jw-gallery-all" onClick={() => show(0)}>
            <IconGrid width={16} height={16} /> {photos.length} fotos
          </button>
        )}
      </div>

      <div className="jw-swipe">
        <div
          className="jw-swipe-track"
          onScroll={(event) => setInlineIndex(Math.round(event.currentTarget.scrollLeft / Math.max(event.currentTarget.clientWidth, 1)))}
        >
          {photos.map((photo, position) => (
            <button key={photo.src} type="button" onClick={() => show(position)} aria-label={`Ver foto ${position + 1} a pantalla completa`}>
              <Image
                {...(position === 0 ? { "data-jw-photo": true, style: { viewTransitionName: "jw-photo" } } : {})}
                src={photo.src}
                alt={photo.alt}
                fill
                priority={position === 0}
                sizes="100vw"
              />
            </button>
          ))}
        </div>
        <span className="jw-swipe-count" aria-hidden="true">{inlineIndex + 1} / {photos.length}</span>
      </div>

      <dialog
        ref={dialog}
        className="jw-lightbox"
        aria-label="Fotos de la propiedad"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(1);
          if (event.key === "ArrowLeft") go(-1);
        }}
      >
        {open && (
          <>
            <div className="jw-lightbox-top">
              <span aria-live="polite">{index + 1} / {photos.length}</span>
              <button type="button" className="jw-icon-btn" aria-label="Cerrar fotos" onClick={() => setOpen(false)}><IconClose /></button>
            </div>
            <div ref={track} className="jw-lightbox-track" tabIndex={0}>
              {photos.map((photo, position) => (
                <figure key={photo.src}>
                  <Image src={photo.src} alt={photo.alt} fill sizes="100vw" loading={Math.abs(position - start) <= 1 ? "eager" : "lazy"} />
                </figure>
              ))}
            </div>
            {photos.length > 1 && (
              <div ref={thumbs} className="jw-lightbox-thumbs">
                {photos.map((photo, position) => (
                  <button
                    key={photo.src}
                    type="button"
                    aria-label={`Ver foto ${position + 1}`}
                    aria-current={position === index ? "true" : undefined}
                    onClick={() => go(position - index)}
                  >
                    <Image src={photo.thumb} alt="" fill sizes="96px" />
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="jw-lightbox-prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Foto anterior"><IconBack /></button>
            <button type="button" className="jw-lightbox-next" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Foto siguiente"><IconArrow /></button>
          </>
        )}
      </dialog>
    </>
  );
}
