"use client";

import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

// Resolve signed URLs for private bucket paths
async function resolveSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  try {
    const res = await fetch("/api/tasaciones/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.urls ?? {};
  } catch {
    return {};
  }
}

/* ── Single Image Uploader ───────────────────────────────── */

interface Props {
  value: string; // storage path (e.g. "mapa_123.avif")
  onChange: (path: string) => void;
  label?: string;
  className?: string;
}

export function ImageUploader({ value, onChange, label, className }: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) { setPreviewUrl(null); return; }
    if (value.startsWith("http")) { setPreviewUrl(value); return; }
    resolveSignedUrls([value]).then((urls) => {
      if (!cancelled) setPreviewUrl(urls[value] ?? null);
    });
    return () => { cancelled = true; };
  }, [value]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tasaciones/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al subir imagen");
        return;
      }
      onChange(data.path);
      setPreviewUrl(data.previewUrl);
      toast.success("Imagen subida");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">{label}</label>}

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-[14px] border border-border">
          <img src={previewUrl} alt="" className="max-h-48 w-full object-contain bg-bg" />
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="rounded-full bg-bg/80 px-2.5 py-1 text-[11px] font-semibold text-text-muted backdrop-blur hover:text-text">Cambiar</button>
            <button type="button" onClick={() => { onChange(""); setPreviewUrl(null); }}
              className="rounded-full bg-clay-chip/90 px-2.5 py-1 text-[11px] font-bold text-terra backdrop-blur hover:opacity-80">Quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-border bg-bg py-8 text-[13px] font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-50">
          {uploading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />Subiendo...</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>Subir imagen</>
          )}
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

/* ── Multi Image Uploader with Drag & Drop ───────────────── */

interface MultiImageUploaderProps {
  images: string[]; // storage paths
  onChange: (paths: string[]) => void;
}

export function MultiImageUploader({ images, onChange }: MultiImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const imagesKey = images.join(",");
  useEffect(() => {
    let cancelled = false;
    const toResolve = images.filter((p) => p && !p.startsWith("http"));
    if (toResolve.length === 0) return;
    resolveSignedUrls(toResolve).then((urls) => {
      if (!cancelled) setPreviewUrls((prev) => ({ ...prev, ...urls }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey]);

  function getPreview(path: string): string {
    if (path.startsWith("http")) return path;
    return previewUrls[path] ?? "";
  }

  async function handleFiles(files: FileList) {
    setUploading(true);
    const uploads = Array.from(files).map(async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tasaciones/upload", { method: "POST", body: form });
      if (!res.ok) return null;
      return (await res.json()) as { path: string; previewUrl: string };
    });

    const results = (await Promise.all(uploads)).filter((r): r is { path: string; previewUrl: string } => r !== null);

    if (results.length > 0) {
      const newPreviews: Record<string, string> = {};
      const newPaths: string[] = [];
      for (const r of results) {
        newPaths.push(r.path);
        newPreviews[r.path] = r.previewUrl;
      }
      setPreviewUrls((prev) => ({ ...prev, ...newPreviews }));
      onChange([...images, ...newPaths]);
      toast.success(`${results.length} imagen${results.length > 1 ? "es" : ""} subida${results.length > 1 ? "s" : ""}`);
    }
    setUploading(false);
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onChange(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((path, i) => {
            const src = getPreview(path);
            return (
              <div
                key={`${path}-${i}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`group relative cursor-grab overflow-hidden rounded-[14px] border transition-all active:cursor-grabbing ${
                  dragOverIndex === i && dragIndex !== i
                    ? "border-border-strong ring-2 ring-accent/40"
                    : dragIndex === i ? "border-border opacity-50" : "border-border"
                }`}
              >
                {src ? (
                  <img src={src} alt={`Foto ${i + 1}`} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-surface text-xs text-text-faint">Cargando...</div>
                )}
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 text-danger opacity-0 transition-opacity group-hover:opacity-100">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <span className="absolute bottom-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-dark/85 px-1.5 font-display text-[10px] font-bold text-dark-fg">{i + 1}</span>
                <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg/60 text-text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
                  </svg>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-border bg-bg py-4 text-[13px] font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-50">
        {uploading ? (
          <><span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />Subiendo...</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>Subir fotos</>
        )}
      </button>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
