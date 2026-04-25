"use client";

import { useEffect, useState } from "react";
import { formatARNumber, parseARNumber } from "@/lib/rentals";

interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Texto chico debajo del input (helper). */
  hint?: string;
}

/**
 * Input de moneda AR — muestra "1.234.567" mientras se tipea, mantiene el número en el state
 * del padre. Si el usuario borra todo, devuelve null.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled,
  className,
  hint,
}: Readonly<CurrencyInputProps>) {
  const [text, setText] = useState<string>(() =>
    value === null || value === 0 ? "" : formatARNumber(value),
  );

  // Si el value cambia desde fuera (reset, edición), refrescamos el texto
  useEffect(() => {
    const current = parseARNumber(text);
    if (value === null) {
      if (text !== "") setText("");
    } else if (current !== value) {
      setText(formatARNumber(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    // Permitir solo dígitos, puntos y coma
    const filtered = raw.replaceAll(/[^\d.,]/g, "");
    if (!filtered) {
      setText("");
      onChange(null);
      return;
    }
    const num = parseARNumber(filtered);
    if (Number.isFinite(num)) {
      // Formatear sin decimales si el usuario no escribió coma
      const hasDecimal = filtered.includes(",");
      if (hasDecimal) {
        // Conservar lo que está después de la coma como decimal escrito
        const [intPart, decPart] = filtered.replaceAll(".", "").split(",");
        const intNum = Number.parseInt(intPart || "0", 10);
        const formatted = `${formatARNumber(intNum)},${(decPart ?? "").slice(0, 2)}`;
        setText(formatted);
      } else {
        setText(formatARNumber(num));
      }
      onChange(num);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-xl border border-border bg-bg py-2 pl-7 pr-3 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none disabled:opacity-60 ${className ?? ""}`}
        />
      </div>
      {hint && <p className="text-[10px] text-text-faint">{hint}</p>}
    </div>
  );
}
