"use client";

import { useRef, useState } from "react";
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
  /** Galería actualizada tras cada cambio (subir / borrar / reordenar / portada). */
  onChange: (photos: EditorPhoto[], coverImageUrl: string | null) => void;
}

type ApiBody = { data?: { photos?: EditorPhoto[]; coverImageUrl?: string | null }; message?: string };

/**
 * Pestaña "Fotos" del modal de propiedad: subir (varias, con progreso),
 * borrar, reordenar (drag & drop o flechas) y elegir portada. Cada acción
 * pega a /api/propiedades/[id]/fotos y reemplaza la galería con la respuesta.
 */
export function PhotosEditor({ propertyId, photos, loading, onChange }: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState(false);

  const api = `/api/propiedades/${propertyId}/fotos`;

  async function apply(res: Response, okMsg?: string) {
    const body = (await res.json().catch(() => ({}))) as ApiBody;
    if (!res.ok) throw new Error(body.message ?? "Error");
    onChange(body.data?.photos ?? [], body.data?.coverImageUrl ?? null);
    if (okMsg) toast.success(okMsg);
  }

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Elegí imágenes (jpg, png, webp…)");
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

  const list = photos ?? [];

  return (
    <div className="space-y-4">
      {/* Zona de subida */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDropHint(true);
        }}
        onDragLeave={() => setDropHint(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropHint(false);
          if (dragging) return; // reordenando, no subiendo
          if (e.dataTransfer.files?.length) void upload(e.dataTransfer.files);
        }}
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
              return (
                <div
                  key={ph.image}
                  draggable
                  onDragStart={(e) => {
                    setDragging(ph.image);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!dragging || dragging === ph.image) return;
                    const from = list.findIndex((p) => p.image === dragging);
                    setDragging(null);
                    move(from, idx);
                  }}
                  className={`group relative overflow-hidden rounded-[14px] border bg-bg ${
                    dragging === ph.image ? "border-accent opacity-50" : "border-border"
                  } ${isBusy ? "opacity-60" : ""}`}
                >
                  <a href={ph.original ?? ph.image} target="_blank" rel="noopener noreferrer" className="block">
                    <Image
                      src={ph.thumb ?? ph.image}
                      alt={ph.description ?? `Foto ${idx + 1}`}
                      width={400}
                      height={300}
                      className="aspect-[4/3] w-full object-cover"
                    />
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
