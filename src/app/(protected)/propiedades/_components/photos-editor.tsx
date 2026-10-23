"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

export interface EditorPhoto {
  image: string;
  thumb: string | null;
  original: string | null;
  order: number;
  description: string | null;
  isFrontCover: boolean;
  isBlueprint: boolean;
}

interface Props {
  propertyId: string;
  photos: EditorPhoto[] | null;
  loading: boolean;
  /** true mientras la pestaña Fotos está visible: habilita soltar archivos en cualquier parte. */
  active?: boolean;
  /** Galería actualizada tras cada cambio (subir / borrar / reordenar / portada). */
  onChange: (photos: EditorPhoto[], coverImageUrl: string | null) => void;
}

/** ¿El arrastre trae archivos del sistema? */
function hasFiles(dt: DataTransfer | null): boolean {
  return Boolean(dt && Array.from(dt.types ?? []).includes("Files"));
}

/** Píxeles que hay que mover el mouse para que un clic pase a ser arrastre. */
const DRAG_THRESHOLD = 6;

type CardDrag = { image: string; from: number; startX: number; startY: number; x: number; y: number; active: boolean };

type ApiBody = { data?: { photos?: EditorPhoto[]; coverImageUrl?: string | null }; message?: string };

/**
 * Pestaña "Fotos" del modal de propiedad: subir (varias, con progreso),
 * borrar, reordenar (drag & drop o flechas) y elegir portada. Cada acción
 * pega a /api/propiedades/[id]/fotos y reemplaza la galería con la respuesta.
 */
export function PhotosEditor({ propertyId, photos, loading, active = true, onChange }: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Reordenar con el mouse: arrastre propio con pointer events (el drag nativo
  // de HTML5 se lo comía el <a>/<img> de la tarjeta y lo tomaba como archivo).
  // En touch se usan las flechas, así que sólo se activa con mouse.
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const suppressClick = useRef(false);
  // Si el optimizador falla (pasa de a ratos), se pide directo al bucket; si
  // tampoco carga, se avisa en la tarjeta.
  const [failed, setFailed] = useState<Record<string, 1 | 2>>({});
  const [dropHint, setDropHint] = useState(false);
  // Arrastre de archivos desde el sistema: se cuenta enter/leave porque el
  // navegador dispara dragleave al pasar por cada hijo.
  const dragDepth = useRef(0);
  const uploadRef = useRef<(files: FileList | File[]) => Promise<void>>(async () => {});

  const api = `/api/propiedades/${propertyId}/fotos`;

  // Mientras la pestaña está visible, soltar archivos en CUALQUIER parte de la
  // página sube las fotos (y nunca abre la imagen en el navegador).
  useEffect(() => {
    if (!active) return;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDropHint(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault(); // sin esto el navegador no permite el drop
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDropHint(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDropHint(false);
      const files = e.dataTransfer?.files;
      if (files?.length) void uploadRef.current(files);
    };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
      dragDepth.current = 0;
      setDropHint(false);
    };
  }, [active]);

  async function apply(res: Response, okMsg?: string) {
    const body = (await res.json().catch(() => ({}))) as ApiBody;
    if (!res.ok) throw new Error(body.message ?? "Error");
    onChange(body.data?.photos ?? [], body.data?.coverImageUrl ?? null);
    if (okMsg) toast.success(okMsg);
  }

  async function upload(files: FileList | File[]) {
    if (uploading) {
      toast.error("Esperá a que termine la subida anterior");
      return;
    }
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast.error("Elegí imágenes (jpg, png, webp…)");
      return;
    }
    setUploading({ done: 0, total: list.length });
    try {
      // De a una: progreso real y un archivo malo no tira los demás.
      for (let i = 0; i < list.length; i++) {
        const fd = new FormData();
        fd.append("files", list[i]);
        const res = await fetch(api, { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as ApiBody;
        if (!res.ok) {
          toast.error(`${list[i].name}: ${body.message ?? "no se pudo subir"}`);
        } else {
          onChange(body.data?.photos ?? [], body.data?.coverImageUrl ?? null);
        }
        setUploading({ done: i + 1, total: list.length });
      }
      toast.success(`${list.length} foto(s) procesada(s)`);
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(ph: EditorPhoto) {
    if (!window.confirm("¿Borrar esta foto? Se elimina del sistema (los avisos ya publicados no se tocan).")) return;
    setBusy(ph.image);
    try {
      await apply(await fetch(api, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: ph.image }) }), "Foto eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo borrar");
    } finally {
      setBusy(null);
    }
  }

  async function setCover(ph: EditorPhoto) {
    setBusy(ph.image);
    try {
      await apply(await fetch(api, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cover: ph.image }) }), "Portada actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar la portada");
    } finally {
      setBusy(null);
    }
  }

  async function reorder(next: EditorPhoto[]) {
    onChange(next.map((p, i) => ({ ...p, order: i })), next.find((p) => p.isFrontCover)?.image ?? next[0]?.image ?? null); // optimista
    try {
      await apply(await fetch(api, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: next.map((p) => p.image) }) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reordenar");
    }
  }

  function move(from: number, to: number) {
    if (!photos || from === to || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    void reorder(next);
  }

  uploadRef.current = upload;
  const list = photos ?? [];

  /** Índice de la tarjeta bajo el puntero (o null). */
  function cardAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-photo-idx]");
    return el ? Number(el.dataset.photoIdx) : null;
  }

  function onCardPointerDown(e: React.PointerEvent<HTMLDivElement>, ph: EditorPhoto, idx: number) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // acciones de la tarjeta
    e.preventDefault(); // sin selección de texto ni drag nativo de la imagen
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ image: ph.image, from: idx, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false });
  }

  function onCardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const active = drag.active || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active });
    if (active) setOver(cardAt(e.clientX, e.clientY));
  }

  function onCardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    if (drag.active) {
      suppressClick.current = true; // que soltar no abra la foto
      const to = cardAt(e.clientX, e.clientY);
      if (to !== null) move(drag.from, to);
    }
    setDrag(null);
    setOver(null);
  }

  function cancelDrag() {
    setDrag(null);
    setOver(null);
  }

  return (
    <div className="relative space-y-4">
      {/* Overlay mientras se arrastran archivos sobre la página */}
      {dropHint && !uploading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border-2 border-dashed border-accent bg-sand-chip/80">
          <p className="rounded-full bg-dark px-4 py-2 text-[13px] font-semibold text-dark-fg">Soltá para subir las fotos</p>
        </div>
      )}

      {/* Zona de subida (el drop lo maneja el listener global; acá sólo el botón) */}
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dropHint ? "border-accent bg-sand-chip/60" : "border-border bg-bg"
        }`}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
        {uploading ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-text" />
            <p className="text-[13px] text-text-muted">
              Subiendo {uploading.done}/{uploading.total}…
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((uploading.done / uploading.total) * 100)}%` }} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[13.5px] font-semibold text-text">Arrastrá fotos acá</p>
            <p className="text-[12px] text-text-faint">o</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center rounded-full bg-dark px-4 text-[12.5px] font-semibold text-dark-fg transition-opacity hover:opacity-90"
            >
              Elegir archivos
            </button>
            <p className="text-[11px] text-text-faint">JPG, PNG o WebP · hasta 15 MB c/u · se generan miniaturas automáticamente</p>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
        </div>
      ) : !list.length ? (
        <p className="py-10 text-center text-[13.5px] text-text-faint">Esta propiedad no tiene fotos cargadas.</p>
      ) : (
        <>
          <p className="text-[11.5px] text-text-faint">
            {list.length} foto{list.length === 1 ? "" : "s"} · arrastrá para reordenar · la primera es la portada salvo que marques otra
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {list.map((ph, idx) => {
              const isBusy = busy === ph.image;
              const isDragged = Boolean(drag?.active && drag.image === ph.image);
              const isTarget = Boolean(drag?.active && over === idx && drag.from !== idx);
              return (
                <div
                  key={ph.image}
                  data-photo-idx={idx}
                  onPointerDown={(e) => onCardPointerDown(e, ph, idx)}
                  onPointerMove={onCardPointerMove}
                  onPointerUp={onCardPointerUp}
                  onPointerCancel={cancelDrag}
                  onLostPointerCapture={() => drag && !drag.active && cancelDrag()}
                  onClickCapture={(e) => {
                    if (!suppressClick.current) return;
                    suppressClick.current = false;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={`group relative select-none overflow-hidden rounded-[14px] border bg-bg transition-shadow sm:cursor-grab ${
                    isDragged ? "border-accent opacity-40" : "border-border"
                  } ${isTarget ? "ring-2 ring-accent ring-offset-2" : ""} ${isBusy ? "opacity-60" : ""}`}
                >
                  {/* draggable=false: si no, el navegador arrastra el link/imagen en vez de la tarjeta */}
                  <a href={ph.original ?? ph.image} target="_blank" rel="noopener noreferrer" className="block" draggable={false}>
                    {failed[ph.image] === 2 ? (
                      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-sand-chip px-2 text-center">
                        <span className="text-[12px] font-semibold text-text-muted">No se pudo cargar</span>
                        <span className="text-[11px] text-text-faint">Borrala y volvé a subirla</span>
                      </div>
                    ) : (
                      <Image
                        src={ph.thumb ?? ph.image}
                        alt={ph.description ?? `Foto ${idx + 1}`}
                        width={400}
                        height={300}
                        unoptimized={failed[ph.image] === 1}
                        draggable={false}
                        onError={() => setFailed((f) => ({ ...f, [ph.image]: f[ph.image] ? 2 : 1 }))}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
                  </a>
                  {ph.isFrontCover && (
                    <span className="absolute left-2 top-2 rounded-full bg-dark px-2 py-0.5 text-[10px] font-bold text-dark-fg">Portada</span>
                  )}
                  {ph.isBlueprint && (
                    <span className="absolute right-2 top-2 rounded-full bg-info-chip px-2 py-0.5 text-[10px] font-bold text-info">Plano</span>
                  )}
                  <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-bold text-text-muted">{idx + 1}</span>

                  {/* Acciones (siempre visibles en touch; hover en desktop) */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-dark/70 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <IconBtn title="Mover antes" onClick={() => move(idx, idx - 1)} disabled={idx === 0 || isBusy}>
                      ‹
                    </IconBtn>
                    <IconBtn title="Mover después" onClick={() => move(idx, idx + 1)} disabled={idx === list.length - 1 || isBusy}>
                      ›
                    </IconBtn>
                    {!ph.isFrontCover && (
                      <IconBtn title="Usar como portada" onClick={() => void setCover(ph)} disabled={isBusy}>
                        ★
                      </IconBtn>
                    )}
                    <IconBtn title="Borrar" onClick={() => void remove(ph)} disabled={isBusy} danger>
                      ✕
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Miniatura que sigue al mouse mientras se arrastra */}
          {drag?.active && (
            <div
              className="pointer-events-none fixed z-50 w-32 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[12px] border-2 border-accent shadow-xl"
              style={{ left: drag.x, top: drag.y, cursor: "grabbing" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- copia efímera de la miniatura ya cargada */}
              <img src={list[drag.from]?.thumb ?? drag.image} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: Readonly<{ title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold transition-colors disabled:opacity-40 ${
        danger ? "bg-surface/95 text-danger hover:bg-clay-chip" : "bg-surface/95 text-text hover:bg-sand-chip"
      }`}
    >
      {children}
    </button>
  );
}
