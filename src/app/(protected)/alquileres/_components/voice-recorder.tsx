"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export interface RentalAttachment {
  kind: "image" | "audio" | "video" | "file";
  path: string;
  name: string;
  size: number;
  mime: string;
}

interface VoiceRecorderProps {
  onUploaded: (attachment: RentalAttachment) => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "review" | "uploading";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickSupportedMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ onUploaded, disabled }: Readonly<VoiceRecorderProps>) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    if (streamRef.current) for (const t of streamRef.current.getTracks()) t.stop();
    streamRef.current = null;
  }

  async function start() {
    if (disabled) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no soporta grabación");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickSupportedMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        // Stripear ";codecs=..." del mime type — algunos servers/navegadores no lo decodifican bien.
        const baseMime = (mime || recorder.mimeType || "audio/webm").split(";")[0];
        const finalBlob = new Blob(chunksRef.current, { type: baseMime });
        if (finalBlob.size === 0) {
          toast.error("La grabación quedó vacía. Volvé a intentar.");
          cleanup();
          setState("idle");
          return;
        }
        setBlob(finalBlob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(finalBlob));
        setState("review");
      };
      // timeslice = chunks cada 1s. Más robusto en navegadores que no flushean al stop().
      recorder.start(1000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setDuration(0);
      tickerRef.current = setInterval(() => setDuration(Date.now() - startedAtRef.current), 200);
      setState("recording");
    } catch (e) {
      console.error(e);
      toast.error("No pudimos acceder al micrófono");
      cleanup();
      setState("idle");
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    if (streamRef.current) for (const t of streamRef.current.getTracks()) t.stop();
    streamRef.current = null;
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setDuration(0);
    setState("idle");
  }

  async function upload() {
    if (!blob) return;
    setState("uploading");
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `nota_de_voz_${Date.now()}.${ext}`, { type: blob.type });
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/alquileres/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al subir");
      onUploaded(body.attachment as RentalAttachment);
      discard();
      toast.success("Nota de voz lista");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setState("review");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.button
            key="rec"
            type="button"
            onClick={start}
            disabled={disabled}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-clay-chip px-3.5 text-[12px] font-bold text-terra transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Grabar
          </motion.button>
        )}
        {state === "recording" && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-clay-chip px-3.5 text-[12px] font-bold text-terra transition-opacity hover:opacity-85"
            >
              <span className="relative flex h-2 w-2">
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full bg-danger-chip"
                  animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
              </span>
              Detener
            </button>
            <span className="font-mono text-xs text-text-muted">{formatDuration(duration)}</span>
          </motion.div>
        )}
        {state === "review" && previewUrl && (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-2">
            <audio src={previewUrl} controls className="h-9 max-w-[260px] flex-1" />
            <button
              type="button"
              onClick={upload}
              className="h-9 rounded-full bg-dark px-4 text-[12px] font-bold text-dark-fg transition-opacity hover:opacity-90"
            >
              Adjuntar
            </button>
            <button
              type="button"
              onClick={discard}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-faint transition-colors hover:bg-bg hover:text-terra"
            >
              ✕
            </button>
          </motion.div>
        )}
        {state === "uploading" && (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[12px] font-semibold text-text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Subiendo…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
