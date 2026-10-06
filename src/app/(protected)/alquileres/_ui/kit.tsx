"use client";

/**
 * Piezas V4 de alquileres: pills de estado, montos, campos y botones. Las
 * clases salen de docs/V4-STYLE-GUIDE.md; acá solo se nombran una vez.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { RentalDueEffectiveStatus } from "@/lib/rentals";
import type { AdjustmentAlert, ContractStatus } from "@/lib/rentals/dto";

export { money, moneyShort, dayLong, dayShort, dateAR, monthLabel, shiftMonth, capitalize, propertyLine, initials } from "./format";

// ──────────────────────────────────────────────────────────────────
// Estados
// ──────────────────────────────────────────────────────────────────

export const DUE_LABEL: Record<RentalDueEffectiveStatus, string> = {
  esperando: "A cobrar",
  vencido: "Vencido",
  pagado: "Cobrado",
  parcial: "Parcial",
  condonado: "Condonado",
};

const DUE_TONE: Record<RentalDueEffectiveStatus, string> = {
  esperando: "bg-sand-chip text-warning",
  vencido: "bg-clay-chip text-terra",
  pagado: "bg-sage-chip text-olive-light",
  parcial: "bg-sand-chip text-warning",
  condonado: "bg-bg text-text-faint",
};

/** Barra de color de los chips del calendario (relleno sólido, sin bordes). */
export const DUE_BAR: Record<RentalDueEffectiveStatus, string> = {
  esperando: "bg-sand-chip text-text",
  vencido: "bg-clay-chip text-terra",
  pagado: "bg-sage-chip text-olive-light",
  parcial: "bg-sand-chip text-warning",
  condonado: "bg-bg text-text-faint",
};

export const DUE_DOT: Record<RentalDueEffectiveStatus, string> = {
  esperando: "bg-warning",
  vencido: "bg-terra",
  pagado: "bg-olive-light",
  parcial: "bg-warning",
  condonado: "bg-text-faint",
};

export function Pill({ tone, children, className = "" }: { tone: string; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${tone} ${className}`}>
      {children}
    </span>
  );
}

export function DuePill({ status }: { status: RentalDueEffectiveStatus }) {
  return <Pill tone={DUE_TONE[status]}>{DUE_LABEL[status]}</Pill>;
}

const CONTRACT_LABEL: Record<ContractStatus, string> = {
  vigente: "Vigente",
  por_vencer: "Por terminar",
  finalizado: "Finalizado",
  futuro: "Empieza pronto",
};
const CONTRACT_TONE: Record<ContractStatus, string> = {
  vigente: "bg-sage-chip text-olive-light",
  por_vencer: "bg-sand-chip text-warning",
  finalizado: "bg-bg text-text-faint",
  futuro: "bg-info-chip text-info",
};

export function ContractPill({ status }: { status: ContractStatus }) {
  return <Pill tone={CONTRACT_TONE[status]}>{CONTRACT_LABEL[status]}</Pill>;
}

export const ADJUST_LABEL: Record<AdjustmentAlert, string> = {
  none: "",
  upcoming: "Aumenta pronto",
  due: "Aumenta esta semana",
  overdue: "Aumento sin aplicar",
};

export function AdjustPill({ alert, children }: { alert: AdjustmentAlert; children?: ReactNode }) {
  if (alert === "none") return null;
  const tone = alert === "overdue" ? "bg-dark text-accent" : "bg-sand-chip text-text";
  return (
    <Pill tone={tone}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={alert === "overdue" ? "" : "text-accent"}>
        <path d="M5 21V3h12l-2.5 4.5L17 12H7v9z" />
      </svg>
      {children ?? ADJUST_LABEL[alert]}
    </Pill>
  );
}

// ──────────────────────────────────────────────────────────────────
// Botones
// ──────────────────────────────────────────────────────────────────

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimarySm =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4.5 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondarySm =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
export const btnGold =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-bold text-dark transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark disabled:opacity-50";
export const btnDanger =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity hover:opacity-90 disabled:opacity-50";
export const btnText = "text-[13px] font-semibold text-text-faint transition-colors hover:text-text";
export const linkAction =
  "font-display text-[12.5px] font-bold text-terra underline-offset-4 decoration-terra/40 hover:underline";

export function ButtonLink({ className = btnSecondarySm, ...props }: ComponentProps<typeof Link>) {
  return <Link className={className} {...props} />;
}

// ──────────────────────────────────────────────────────────────────
// Campos
// ──────────────────────────────────────────────────────────────────

export const inputBox =
  "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text outline-none transition-colors placeholder:text-text-faint hover:border-border-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";
export const textareaBox =
  "w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none transition-colors placeholder:text-text-faint hover:border-border-strong focus:border-accent";

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] leading-snug text-text-faint">{hint}</p>}
    </div>
  );
}

/** Segmentado V4 (pill oscura para la opción activa). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full ${size === "sm" ? "px-3 py-1 text-[12px]" : "px-4 py-1.5 text-[12.5px]"} transition-colors ${
              active ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox V4: caja oscura con check dorado. */
export function Check({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? "bg-dark text-accent" : "border border-border-strong bg-surface"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      {label && <span className="text-[13px] text-text">{label}</span>}
    </label>
  );
}

/** Switch V4: oliva encendido, borde apagado. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${checked ? "bg-olive-light" : "bg-border-strong"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-[20px] border border-border bg-surface p-4 md:p-5 ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold text-text">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] bg-bg px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-chip text-accent">{icon}</div>
      <p className="mt-3 font-display text-[15px] font-semibold text-text">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-text-faint">{children}</div>}
    </div>
  );
}

/** Llamada JSON a las APIs del proyecto (envelope { data, message }). */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined && { "Content-Type": "application/json" }), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? "Algo salió mal. Probá de nuevo.");
  return body?.data as T;
}
