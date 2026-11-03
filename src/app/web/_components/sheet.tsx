"use client";

import { useRef, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { IconClose } from "./icons";
import { useModal } from "./use-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

const DISMISS_DISTANCE = 90;

/** Hoja inferior en el celular, que se cierra deslizando hacia abajo. Panel lateral en escritorio. */
export function Sheet({ open, onClose, title, children, footer, onSubmit, className }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; offset: number } | null>(null);
  useModal(dialog, open);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { startY: event.clientY, offset: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (dialog.current) dialog.current.style.transition = "none";
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !dialog.current) return;
    drag.current.offset = Math.max(0, event.clientY - drag.current.startY);
    dialog.current.style.transform = `translateY(${drag.current.offset}px)`;
  }

  function onPointerEnd() {
    if (!drag.current || !dialog.current) return;
    const { offset } = drag.current;
    drag.current = null;
    dialog.current.style.transition = "";
    dialog.current.style.transform = "";
    if (offset > DISMISS_DISTANCE) onClose();
  }

  const body = (
    <>
      <div className="jw-sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <span className="jw-grabber" aria-hidden="true" />
        <h2>{title}</h2>
        <button type="button" className="jw-icon-btn" aria-label={`Cerrar ${title.toLowerCase()}`} onClick={onClose}><IconClose /></button>
      </div>
      <div className="jw-sheet-body">{children}</div>
      {footer && <div className="jw-sheet-foot">{footer}</div>}
    </>
  );

  return (
    <dialog
      ref={dialog}
      className={`jw-sheet ${className ?? ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      {/* El foco inicial va al marco: si no, el navegador marca la X al abrir. */}
      {open && <div tabIndex={-1} autoFocus data-jw-autofocus className="jw-sheet-focus">{onSubmit ? <form className="jw-sheet-frame" onSubmit={onSubmit}>{body}</form> : <div className="jw-sheet-frame">{body}</div>}</div>}
    </dialog>
  );
}
