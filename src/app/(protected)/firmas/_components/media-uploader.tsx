"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/signatures";
import { VoiceRecorder } from "./voice-recorder";

interface MediaUploaderProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  signedUrls?: Record<string, string>;
  compact?: boolean;
}

export function MediaUploader({
  attachments,
  onChange,
  signedUrls,
  compact,
}: Readonly<MediaUploaderProps>) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next = [...attachments];
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/firmas/upload", { method: "POST", body: formData });
        const body = await res.json();
        if (!res.ok) {
          toast.error(body?.error ?? "Error al subir un archivo");
          continue;
        }
        next.push(body.attachment as Attachment);
      }
      onChange(next);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(path: string) {
    onChange(attachments.filter((a) => a.path !== path));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-olive-bright/40 hover:text-text ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-olive-bright border-t-transparent" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          )}
          Adjuntar archivos
        </label>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,application/pdf,application/zip,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <VoiceRecorder
          onUploaded={(att) => onChange([...attachments, att])}
          disabled={uploading}
        />
      </div>

      {attachments.length > 0 && (
        <div className={`grid gap-2 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          {attachments.map((att) => (
            <AttachmentPreview
              key={att.path}
              attachment={att}
              url={signedUrls?.[att.path]}
              onRemove={() => removeAttachment(att.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  url?: string;
  onRemove?: () => void;
}

export function AttachmentPreview({
  attachment,
  url,
  onRemove,
}: Readonly<AttachmentPreviewProps>) {
  const { kind, name } = attachment;

  return (
    <div className="group relative flex flex-col gap-1 overflow-hidden rounded-xl border border-border bg-bg/60 p-1.5">
      {kind === "image" && url && (
        <a href={url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg bg-bg">
          <img src={url} alt={name} className="h-full w-full object-cover" />
        </a>
      )}
      {kind === "image" && !url && <SkeletonBox label="imagen" />}
      {kind === "video" && url && (
        <video src={url} controls playsInline className="aspect-square w-full rounded-lg bg-black object-cover" />
      )}
      {kind === "video" && !url && <SkeletonBox label="video" />}
      {kind === "audio" && (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-elevated px-2 py-3 text-center">
          {url ? (
            <audio src={url} controls className="w-full" />
          ) : (
            <SkeletonBox label="audio" />
          )}
        </div>
      )}
      {kind === "file" && (
        <a
          href={url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-elevated text-center text-[11px] text-text-muted hover:text-text"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="px-1 line-clamp-2">{name}</span>
        </a>
      )}
      <p className="truncate px-1 text-[10px] text-text-faint" title={name}>
        {name}
      </p>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${name}`}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 text-text-muted opacity-0 transition-all hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SkeletonBox({ label }: { label: string }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-bg text-[10px] uppercase tracking-wider text-text-faint">
      {label}
    </div>
  );
}
