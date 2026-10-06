"use client";

import { useCallback, useRef, useState } from "react";
import { Sheet } from "../../_components/sheet";
import { btnDanger, btnPrimary, btnText, textareaBox } from "./kit";

interface AskOptions {
  title: string;
  description?: string;
  confirmLabel: string;
  /** Pide un motivo; si es obligatorio no deja confirmar vacío. */
  reason?: "required" | "optional" | "none";
  placeholder?: string;
  danger?: boolean;
}

/**
 * Confirmación con motivo opcional, en el Sheet del sistema (sin prompt/confirm
 * del navegador). Uso: const [dialog, ask] = useReasonSheet(); const r = await ask({...}).
 * Devuelve el texto (o "" si no pide motivo) o null si se canceló.
 */
export function useReasonSheet(): [React.ReactNode, (o: AskOptions) => Promise<string | null>] {
  const [opts, setOpts] = useState<AskOptions | null>(null);
  const [text, setText] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const ask = useCallback((o: AskOptions) => {
    setOpts(o);
    setText("");
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  const needs = opts?.reason === "required";
  const node = (
    <Sheet
      open={Boolean(opts)}
      onClose={() => close(null)}
      title={opts?.title ?? ""}
      description={opts?.description}
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" className={btnText} onClick={() => close(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className={opts?.danger ? btnDanger + " h-11 px-5" : btnPrimary}
            disabled={needs && !text.trim()}
            onClick={() => close(text.trim())}
          >
            {opts?.confirmLabel}
          </button>
        </>
      }
    >
      {opts && opts.reason !== "none" && (
        <textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={opts.placeholder}
          aria-label="Motivo"
          className={textareaBox}
        />
      )}
    </Sheet>
  );
  return [node, ask];
}
