"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconCheck, IconChevron } from "./icons";
import { useModal } from "./use-modal";

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: SelectOption[];
  /** Con `name`, viaja en el formulario que lo contiene. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: "field" | "bar";
};

/**
 * Lista propia: el <select> del sistema cambia con cada celular y navegador. En el
 * celular abre una hoja inferior con tilde; en escritorio, una lista junto al botón.
 */
export function Select({ label, options, name, value, defaultValue = "", onChange, variant = "field" }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties | undefined>();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const current = value ?? internal;
  const selected = options.find((option) => option.value === current);
  useModal(dialog, open);

  function openPicker() {
    const rect = button.current?.getBoundingClientRect();
    if (rect && window.matchMedia("(min-width: 901px)").matches) {
      const height = Math.min(360, options.length * 46 + 16);
      const below = window.innerHeight - rect.bottom > height + 16;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 240) - 16),
        top: below ? rect.bottom + 6 : Math.max(16, rect.top - height - 6),
        width: Math.max(rect.width, 240),
      });
    } else {
      setPosition(undefined);
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function pick(next: string) {
    setInternal(next);
    onChange?.(next);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const target = dialog.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? dialog.current?.querySelector<HTMLElement>('[role="option"]');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(dialog.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    items[Math.min(items.length - 1, Math.max(0, moves[event.key]))]?.focus();
  }

  return (
    <div className="jw-select" data-variant={variant}>
      {name && current && <input type="hidden" name={name} value={current} />}
      <button ref={button} type="button" className="jw-select-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${selected?.label ?? "sin elegir"}`} onClick={openPicker}>
        <span className="jw-select-label">{label}</span>
        <span className="jw-select-value">{selected?.label ?? ""}</span>
        <IconChevron width={16} height={16} />
      </button>
      <dialog
        ref={dialog}
        className="jw-picker"
        data-anchored={Boolean(position)}
        style={position}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        {open && (
          <div className="jw-picker-frame">
            <span className="jw-grabber" aria-hidden="true" />
            <h2 id={titleId} className="jw-picker-title">{label}</h2>
            <div role="listbox" aria-labelledby={titleId} className="jw-picker-list" onKeyDown={onKeyDown}>
              {options.map((option) => (
                <button key={option.value || "todos"} type="button" role="option" aria-selected={option.value === current} onClick={() => pick(option.value)}>
                  <span>{option.label}</span>
                  {option.value === current && <IconCheck width={18} height={18} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
