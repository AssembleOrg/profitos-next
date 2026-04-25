"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Attachment } from "@/lib/signatures";

interface VoiceRecorderProps {
  onUploaded: (attachment: Attachment) => void;
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
      cleanupRecorder();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupRecorder() {
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
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    streamRef.current = null;
  }

  async function startRecording() {
    if (disabled) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no soporta grabación de audio");
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
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        // Stripear ";codecs=..." — algunos servers/navegadores no decodifican bien con parameters.
        const baseMime = (mime || recorder.mimeType || "audio/webm").split(";")[0];
        const finalBlob = new Blob(chunksRef.current, { type: baseMime });
        if (finalBlob.size === 0) {
          toast.error("La grabación quedó vacía. Volvé a intentar.");
          cleanupRecorder();
          setState("idle");
          return;
        }
        setBlob(finalBlob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(finalBlob));
        setState("review");
      };
      // timeslice = chunks cada 1s. Más robusto si el navegador no flushea al stop().
      recorder.start(1000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setDuration(0);
      tickerRef.current = setInterval(() => {
        setDuration(Date.now() - startedAtRef.current);
      }, 200);
      setState("recording");
    } catch (error) {
      console.error("[VoiceRecorder] mic error:", error);
      toast.error("No pudimos acceder al micrófono");
      cleanupRecorder();
      setState("idle");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    streamRef.current = null;
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setDuration(0);
    setState("idle");
  }

  async function uploadRecording() {
    if (!blob) return;
    setState("uploading");
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `nota_de_voz_${Date.now()}.${ext}`, { type: blob.type });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/firmas/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al subir el audio");
      onUploaded(body.attachment as Attachment);
      discard();
      toast.success("Nota de voz lista");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir el audio");
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
            onClick={startRecording}
            disabled={disabled}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            title="Grabar nota de voz"
          >
            <span className="flex h-2 w-2 rounded-full bg-red-400" />
            Grabar
          </motion.button>
        )}

        {state === "recording" && (
          <motion.div
            key="rec-active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              <span className="relative flex h-2 w-2">
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full bg-red-400/60"
                  animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
              </span>
              Detener
            </button>
            <span className="font-mono text-xs text-text-muted">{formatDuration(duration)}</span>
          </motion.div>
        )}

        {state === "review" && previewUrl && (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center gap-2"
          >
            <audio src={previewUrl} controls className="h-9 max-w-[260px] flex-1" />
            <button
              type="button"
              onClick={uploadRecording}
              className="rounded-xl border border-olive-bright/30 bg-olive-mid px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-olive-vivid"
            >
              Adjuntar
            </button>
            <button
              type="button"
              onClick={discard}
              className="rounded-xl border border-border px-2.5 py-2 text-xs text-text-muted transition-colors hover:border-red-500/40 hover:text-red-300"
              title="Descartar"
            >
              ✕
            </button>
          </motion.div>
        )}

        {state === "uploading" && (
          <motion.div
            key="up"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-muted"
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-olive-bright border-t-transparent" />
            Subiendo…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
