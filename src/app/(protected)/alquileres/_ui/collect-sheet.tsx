"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReceiptNo } from "@/lib/rentals/money";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { DateField } from "../../_components/date-field";
import { SelectField } from "@/components/ui/select-field";
import { CurrencyInput } from "../_components/currency-input";
import { MediaUploader } from "../_components/media-uploader";
import type { RentalAttachment } from "../_components/voice-recorder";
import { useSignedUrls } from "../_components/use-signed-urls";
import { splitCharges, type ChargeLine } from "@/lib/rentals/money";

import type { CollectContext } from "@/lib/rentals/dto";
import { IconCheck, IconFlag, IconPlus, IconReceipt, IconX } from "./icons";
import {
  Check,
  DuePill,
  Field,
  Segmented,
  Switch,
  api,
  btnPrimary,
  btnSecondarySm,
  btnText,
  dateAR,
  money,
  propertyLine,
  textareaBox,
} from "./kit";

interface EditableLine extends ChargeLine {
  key: string;
  included: boolean;
}

interface CollectResult {
  transactionId: string;
  receiptIds: string[];
  nextStatus: string;
  pdfErrors: string[];
}

const METHODS = ["Efectivo", "Transferencia", "Depósito", "Cheque", "Mercado Pago", "Otro"];
const QUICK_EXTRAS = ["Punitorios", "Diferencia de aumento", "Expensas", "Otros"];

let lineSeq = 0;
const nextKey = () => `l${++lineSeq}`;

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/**
 * Hoja de cobro. A la izquierda los conceptos del mes (editables); a la
 * derecha el total del inquilino partiéndose en vivo en sus dos recibos:
 * "por cuenta de terceros" (inquilino) y "recibo" (propietario, menos honorarios).
 */
export function CollectSheet({
  dueId,
  open,
  onClose,
  onDone,
}: {
  dueId: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [ctx, setCtx] = useState<CollectContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [feePercent, setFeePercent] = useState<number>(5);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("Efectivo");
  const [mode, setMode] = useState<"total" | "parcial">("total");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [tenantNo, setTenantNo] = useState("");
  const [ownerNo, setOwnerNo] = useState("");
  const [issueOwner, setIssueOwner] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CollectResult | null>(null);
  const signedUrls = useSignedUrls(attachments.map((a) => a.path));
  const tenantTaken = useNumberTaken(open && !result ? "inquilino" : null, tenantNo);
  const ownerTaken = useNumberTaken(open && !result && issueOwner ? "propietario" : null, ownerNo);

  useEffect(() => {
    if (!open || !dueId) return;
    let cancelled = false;
    setCtx(null);
    setLoadError(null);
    setResult(null);
    api<CollectContext>(`/api/alquileres/vencimientos/${dueId}/cobro`)
      .then((data) => {
        if (cancelled) return;
        setCtx(data);
        const remaining = Math.max(0, data.expected - data.alreadyCollected);
        const partialBefore = data.alreadyCollected > 0;
        setLines(
          partialBefore
            ? [{ key: nextKey(), kind: "rent", label: "Saldo del alquiler", amount: remaining, included: true }]
            : data.lines.map((l) => ({ ...l, key: nextKey() })),
        );
        setFeePercent(data.feePercent);
        setPaidAt(todayISO());
        setMethod("Efectivo");
        setMode("total");
        setReceiptNotes("");
        setNotes("");
        setAttachments([]);
        setIssueOwner(true);
        const t = data.books.find((b) => b.kind === "inquilino");
        const o = data.books.find((b) => b.kind === "propietario");
        setTenantNo(t ? String(t.nextNumber) : "");
        setOwnerNo(o ? String(o.nextNumber) : "");
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [open, dueId]);

  const active = useMemo(() => lines.filter((l) => l.included && l.amount > 0), [lines]);
  const split = useMemo(() => splitCharges(active, feePercent), [active, feePercent]);
  const currency = ctx?.currency ?? "ARS";
  const tenantBook = ctx?.books.find((b) => b.kind === "inquilino");
  const ownerBook = ctx?.books.find((b) => b.kind === "propietario");

  function patchLine(key: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addExtra(label: string) {
    setLines((prev) => [...prev, { key: nextKey(), kind: "extra", label, amount: 0, included: true }]);
  }

  async function submit() {
    if (!ctx || saving) return;
    if (split.tenantTotal <= 0) {
      toast.error("El total a cobrar tiene que ser mayor a cero");
      return;
    }
    setSaving(true);
    try {
      const data = await api<CollectResult>(`/api/alquileres/vencimientos/${ctx.dueId}/cobros`, {
        method: "POST",
        json: {
          lines: active.map(({ kind, label, amount, refId }) => ({ kind, label, amount, refId })),
          feePercent,
          isFull: mode === "total",
          paidAt: `${paidAt}T12:00:00-03:00`,
          method,
          notes,
          receiptNotes,
          attachments,
          tenantReceiptNumber: tenantNo ? Number(tenantNo) : null,
          ownerReceiptNumber: issueOwner && ownerNo ? Number(ownerNo) : null,
          issueOwnerReceipt: issueOwner,
        },
      });
      setResult(data);
      if (data.pdfErrors.length) toast.warning("El cobro quedó registrado, pero algún PDF no se generó. Abrilo de nuevo para reintentar.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el cobro");
    } finally {
      setSaving(false);
    }
  }

  const title = result ? "Cobro registrado" : ctx ? `Cobrar ${ctx.periodLabel.toLowerCase()}` : "Cobrar alquiler";
  const description = ctx ? `${propertyLine(ctx.property.address, ctx.unit)} · ${ctx.tenant.fullName}` : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth="sm:max-w-[920px]"
      closeOnOverlay={false}
      footer={
        result ? (
          <>
            <span />
            <button type="button" className={btnPrimary} onClick={onClose}>
              Listo
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btnText} onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className={btnPrimary} onClick={submit} disabled={!ctx || saving || split.tenantTotal <= 0}>
              <IconReceipt size={16} className="text-accent" />
              {saving ? "Registrando…" : `Cobrar ${money(split.tenantTotal, currency)}`}
            </button>
          </>
        )
      }
    >
      {loadError && <p className="rounded-[14px] bg-clay-chip px-4 py-3 text-[13px] text-terra">{loadError}</p>}
      {!ctx && !loadError && <CollectSkeleton />}
      {ctx && result && <CollectDone ctx={ctx} result={result} split={split} />}
      {ctx && !result && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-[auto_1fr]">
          <div className="flex min-w-0 flex-col gap-5 md:col-start-1">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
              <DuePill status={ctx.status} />
              <span>Vence el {dateAR(ctx.dueDate)}</span>
              {ctx.alreadyCollected > 0 && <span>· ya cobrado {money(ctx.alreadyCollected, currency)}</span>}
            </div>

            {(ctx.adjustmentAlert === "due" || ctx.adjustmentAlert === "overdue") && ctx.adjustmentDate && (
              <p className="flex items-start gap-2 rounded-[14px] bg-sand-chip px-3.5 py-2.5 text-[12.5px] text-text">
                <IconFlag size={15} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Este contrato tiene un aumento {ctx.adjustmentAlert === "overdue" ? "pendiente desde" : "el"} {dateAR(ctx.adjustmentDate)}. Si el
                  índice todavía no salió, cobrá el monto actual y sumá la diferencia el mes que viene.
                </span>
              </p>
            )}

            <section aria-labelledby="concepts-title">
              <h3 id="concepts-title" className="mb-2 font-display text-[15px] font-semibold text-text">
                Conceptos del mes
              </h3>
              <ul className="flex flex-col divide-y divide-border rounded-[18px] border border-border">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 px-3.5 py-2.5">
                    <Check checked={l.included} onChange={(v) => patchLine(l.key, { included: v })} />
                    {l.kind === "extra" ? (
                      <input
                        aria-label="Concepto"
                        value={l.label}
                        onChange={(e) => patchLine(l.key, { label: e.target.value })}
                        className="h-9 min-w-0 flex-1 rounded-[10px] border border-transparent bg-bg px-2.5 text-[13.5px] text-text outline-none focus:border-accent"
                      />
                    ) : (
                      <span className={`min-w-0 flex-1 truncate text-[13.5px] ${l.included ? "text-text" : "text-text-faint line-through"}`}>
                        {l.label}
                        {l.kind === "rent" && <span className="ml-1.5 text-[11.5px] text-text-faint">base de honorarios</span>}
                      </span>
                    )}
                    <div className="w-[132px] shrink-0">
                      <CurrencyInput value={l.amount} onChange={(v) => patchLine(l.key, { amount: v ?? 0 })} disabled={!l.included} />
                    </div>
                    {l.kind === "extra" && (
                      <button
                        type="button"
                        aria-label={`Quitar ${l.label}`}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-faint hover:bg-clay-chip hover:text-terra"
                      >
                        <IconX size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_EXTRAS.map((label) => (
                  <button key={label} type="button" onClick={() => addExtra(label)} className={btnSecondarySm}>
                    <IconPlus size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </section>

          </div>
          <SplitPanel
            currency={currency}
            split={split}
            tenantName={ctx.tenant.fullName}
            ownerName={ctx.owner?.fullName ?? null}
            tenantPos={tenantBook?.pointOfSale ?? 1}
            ownerPos={ownerBook?.pointOfSale ?? 1}
            tenantNo={tenantNo}
            ownerNo={ownerNo}
            onTenantNo={setTenantNo}
            onOwnerNo={setOwnerNo}
            tenantConfigured={tenantBook?.configured ?? true}
            ownerConfigured={ownerBook?.configured ?? true}
            issueOwner={issueOwner}
            onIssueOwner={setIssueOwner}
            feePercent={feePercent}
            onFeePercent={setFeePercent}
            contractFee={ctx.feePercent}
            tenantTaken={tenantTaken}
            ownerTaken={ownerTaken}
          />
          <div className="flex min-w-0 flex-col gap-5 md:col-start-1 md:row-start-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de cobro">
                <DateField value={paidAt} onChange={(v) => setPaidAt(v || todayISO())} clearable={false} />
              </Field>
              <Field label="Medio de pago">
                <SelectField value={method} onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </SelectField>
              </Field>
              <Field label="Tipo de cobro" hint={mode === "parcial" ? "La cuota queda como parcial hasta completar el saldo." : undefined}>
                <Segmented
                  ariaLabel="Tipo de cobro"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "total", label: "Pago total" },
                    { value: "parcial", label: "A cuenta" },
                  ]}
                />
              </Field>
            </div>

            <Field label="Observaciones del recibo" hint="Se imprimen en los dos recibos. Ej.: abona la diferencia del aumento en noviembre.">
              <textarea rows={2} value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} className={textareaBox} />
            </Field>

            {ctx.tenantServices.length > 0 && <ServicesCheck ctx={ctx} />}

            <details className="group rounded-[18px] border border-border px-4 py-3">
              <summary className="cursor-pointer list-none text-[13px] font-semibold text-text-muted marker:hidden">
                Nota interna y adjuntos del cobro
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <textarea
                  rows={2}
                  placeholder="Solo la ve el equipo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={textareaBox}
                  aria-label="Nota interna"
                />
                <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} compact />
              </div>
            </details>
          </div>

        </div>
      )}
    </Sheet>
  );
}

function ServicesCheck({ ctx }: { ctx: CollectContext }) {
  const byService = new Map(ctx.proofsThisPeriod.map((p) => [p.service, p.status]));
  return (
    <section aria-label="Servicios que paga el inquilino" className="rounded-[18px] bg-bg px-4 py-3">
      <p className="text-[12.5px] font-semibold text-text-muted">Servicios que paga el inquilino · comprobantes de {ctx.periodLabel.toLowerCase()}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {ctx.tenantServices.map((s) => {
          const st = byService.get(s);
          const tone =
            st === "aprobado" ? "bg-sage-chip text-olive-light" : st === "pendiente" ? "bg-sand-chip text-warning" : st === "rechazado" ? "bg-clay-chip text-terra" : "bg-surface text-text-faint border border-border";
          const label = st === "aprobado" ? "ok" : st === "pendiente" ? "a revisar" : st === "rechazado" ? "rechazado" : "falta";
          return (
            <li key={s} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
              {s} · {label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stub({
  title,
  subtitle,
  party,
  amount,
  currency,
  pos,
  number,
  onNumber,
  configured,
  disabled,
  dark,
  warning,
}: {
  title: string;
  subtitle: string;
  party: string;
  amount: number;
  currency: string;
  pos: number;
  number: string;
  onNumber: (v: string) => void;
  configured: boolean;
  disabled?: boolean;
  dark?: boolean;
  warning?: string | null;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[18px] p-4 transition-opacity ${dark ? "bg-dark text-dark-fg" : "border border-border bg-surface"} ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[14px] font-semibold">{title}</p>
          <p className={`text-[11.5px] ${dark ? "text-dark-muted" : "text-text-faint"}`}>{subtitle}</p>
        </div>
        <label className={`flex shrink-0 items-center rounded-full px-2 py-1 text-[11.5px] font-bold tabular-nums ${dark ? "bg-white/10" : "bg-bg"}`}>
          <span className={dark ? "text-dark-muted" : "text-text-faint"}>N° {String(pos).padStart(4, "0")}-</span>
          <input
            value={number}
            disabled={disabled}
            onChange={(e) => onNumber(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            aria-label={`Número de ${title.toLowerCase()}`}
            className={`w-[62px] bg-transparent text-right outline-none ${dark ? "text-dark-fg" : "text-text"}`}
          />
        </label>
      </div>
      {/* Línea de corte del talonario: muescas + punteado */}
      <div aria-hidden className={`relative -mx-4 my-3 h-0 border-t border-dashed ${dark ? "border-white/20" : "border-border-strong"}`}>
        <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-surface" />
        <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-surface" />
      </div>
      <p className={`truncate text-[12px] ${dark ? "text-dark-muted" : "text-text-faint"}`}>{party}</p>
      <motion.p
        key={Math.round(amount)}
        initial={{ opacity: 0.4, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-[26px] font-bold tabular-nums leading-tight"
      >
        {money(amount, currency)}
      </motion.p>
      {warning && !disabled && (
        <p role="alert" className={`mt-2 text-[11.5px] font-semibold ${dark ? "text-accent" : "text-terra"}`}>
          {warning}
        </p>
      )}
      {!configured && !disabled && !warning && (
        <p className={`mt-2 text-[11.5px] ${dark ? "text-accent" : "text-warning"}`}>
          Primer recibo del sistema: confirmá que el número coincida con tu talonario.
        </p>
      )}
    </div>
  );
}

function SplitPanel(props: {
  currency: string;
  split: ReturnType<typeof splitCharges>;
  tenantName: string;
  ownerName: string | null;
  tenantPos: number;
  ownerPos: number;
  tenantNo: string;
  ownerNo: string;
  onTenantNo: (v: string) => void;
  onOwnerNo: (v: string) => void;
  tenantConfigured: boolean;
  ownerConfigured: boolean;
  issueOwner: boolean;
  onIssueOwner: (v: boolean) => void;
  feePercent: number;
  onFeePercent: (v: number) => void;
  contractFee: number;
  tenantTaken: string | null;
  ownerTaken: string | null;
}) {
  const { currency, split } = props;
  return (
    <aside aria-label="Recibos que se emiten" className="flex flex-col gap-0 md:sticky md:top-0 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
      <Stub
        dark
        subtitle="Por cuenta de terceros"
        title="Recibo al inquilino"
        party={props.tenantName}
        amount={split.tenantTotal}
        currency={currency}
        pos={props.tenantPos}
        number={props.tenantNo}
        onNumber={props.onTenantNo}
        configured={props.tenantConfigured}
        warning={props.tenantTaken}
      />
      <div className="relative flex items-center justify-between px-4 py-3">
        <span aria-hidden className="absolute bottom-0 left-8 top-0 border-l-2 border-dashed border-border-strong" />
        <label className="ml-8 flex items-center gap-1.5 pl-3 text-[12.5px] text-text-muted">
          Honorarios
          <span className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={Number.isFinite(props.feePercent) ? props.feePercent : ""}
              onChange={(e) => props.onFeePercent(e.target.value === "" ? 0 : Number(e.target.value))}
              aria-label="Porcentaje de honorarios"
              className="h-8 w-[68px] rounded-full border border-border bg-surface pl-3 pr-6 text-[13px] font-bold tabular-nums text-text outline-none focus:border-accent"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-faint">%</span>
          </span>
          {props.feePercent !== props.contractFee && (
            <button
              type="button"
              onClick={() => props.onFeePercent(props.contractFee)}
              aria-label={`Volver a ${props.contractFee}%`}
              title={`Volver a ${props.contractFee}%`}
              className="whitespace-nowrap rounded-full px-1.5 text-[11.5px] font-semibold text-terra hover:bg-clay-chip"
            >
              usar {props.contractFee}%
            </button>
          )}
        </label>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={Math.round(split.feeAmount)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="shrink-0 whitespace-nowrap font-display text-[14px] font-bold tabular-nums text-terra"
          >
            − {money(split.feeAmount, currency)}
          </motion.span>
        </AnimatePresence>
      </div>
      <Stub
        subtitle="Neto, sin honorarios"
        title="Recibo al propietario"
        party={props.ownerName ?? "Sin propietario cargado"}
        amount={split.ownerTotal}
        currency={currency}
        pos={props.ownerPos}
        number={props.ownerNo}
        onNumber={props.onOwnerNo}
        configured={props.ownerConfigured}
        warning={props.ownerTaken}
        disabled={!props.issueOwner}
      />
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className="text-[12.5px] text-text-muted">Emitir recibo al propietario</span>
        <Switch checked={props.issueOwner} onChange={props.onIssueOwner} label="Emitir recibo al propietario" />
      </div>
    </aside>
  );
}

function CollectDone({ ctx, result, split }: { ctx: CollectContext; result: CollectResult; split: ReturnType<typeof splitCharges> }) {
  const [first, second] = result.receiptIds;
  const phone = ctx.tenant.phone?.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `Hola ${ctx.tenant.fullName.split(" ")[0]}, registramos tu pago de ${ctx.periodLabel.toLowerCase()} por ${money(split.tenantTotal, ctx.currency)}. Podés descargar el recibo desde el portal de inquilinos. ¡Gracias! — Juliana Profitos Propiedades`,
  );
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-chip text-olive-light"
      >
        <IconCheck size={26} />
      </motion.div>
      <p className="mt-3 font-display text-[20px] font-semibold text-text">{money(split.tenantTotal, ctx.currency)} cobrados</p>
      <p className="mt-1 text-[13px] text-text-muted">
        {ctx.periodLabel} · {propertyLine(ctx.property.address, ctx.unit)}
      </p>
      <div className="mt-5 grid w-full max-w-md gap-2 sm:grid-cols-2">
        {first && (
          <a href={`/api/alquileres/recibos/${first}/pdf`} target="_blank" rel="noreferrer" className={btnSecondarySm + " h-11"}>
            <IconReceipt size={15} /> Recibo inquilino
          </a>
        )}
        {second && (
          <a href={`/api/alquileres/recibos/${second}/pdf`} target="_blank" rel="noreferrer" className={btnSecondarySm + " h-11"}>
            <IconReceipt size={15} /> Recibo propietario
          </a>
        )}
      </div>
      {phone && (
        <a
          href={`https://wa.me/${phone.startsWith("54") ? phone : `54${phone}`}?text=${waText}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 font-display text-[12.5px] font-bold text-terra underline-offset-4 hover:underline"
        >
          Avisarle por WhatsApp
        </a>
      )}
    </div>
  );
}

function CollectSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true" aria-label="Cargando cobro">
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-[14px] bg-bg" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-32 animate-pulse rounded-[18px] bg-bg" />
        <div className="h-32 animate-pulse rounded-[18px] bg-bg" />
      </div>
    </div>
  );
}

/** Avisa antes de cobrar si el número propuesto ya está usado o anulado en el talonario. */
function useNumberTaken(kind: "inquilino" | "propietario" | null, number: string): string | null {
  const [taken, setTaken] = useState<{ key: string; msg: string | null }>({ key: "", msg: null });
  const key = kind && number ? `${kind}:${number}` : "";
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/alquileres/talonarios?tipo=${kind}&numero=${number}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => setTaken({ key, msg: b?.data?.taken ? `El ${formatReceiptNo(b.data.pointOfSale, Number(number))} ya está ${b.data.status === "anulado" ? "anulado" : "usado"}. Usá otro número.` : null }))
        .catch(() => {});
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [key, kind, number]);
  return taken.key === key ? taken.msg : null;
}
