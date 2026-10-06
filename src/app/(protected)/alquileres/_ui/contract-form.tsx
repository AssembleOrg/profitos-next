"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { DateField } from "../../_components/date-field";
import { SelectField } from "@/components/ui/select-field";
import { CurrencyInput } from "../_components/currency-input";
import { MediaUploader } from "../_components/media-uploader";
import type { RentalAttachment } from "../_components/voice-recorder";
import { useSignedUrls } from "../_components/use-signed-urls";
import { splitCharges } from "@/lib/rentals/money";
import type { ContractDossier } from "@/lib/rentals/dto";
import { SearchPicker, type PickerItem } from "./search-picker";
import { IconArrowLeft, IconPlus, IconX } from "./icons";
import { Check, Field, Segmented, api, btnPrimary, btnSecondarySm, btnText, dateAR, inputBox, money, textareaBox } from "./kit";

const ADJUST_EVERY = [
  { value: "", label: "Sin aumentos" },
  { value: "3", label: "Cada 3 meses" },
  { value: "4", label: "Cada 4 meses" },
  { value: "6", label: "Cada 6 meses" },
  { value: "12", label: "Cada 12 meses" },
];
const INDEXES = ["IPC", "ICL", "CAC", "Casa Propia", "Fijo", "Otro"];
const SERVICES = ["Luz", "Gas", "Agua", "Municipal", "Expensas", "Internet"];
const GUARANTEES = [
  { value: "", label: "Sin definir" },
  { value: "propietaria", label: "Garantía propietaria" },
  { value: "seguro_caucion", label: "Seguro de caución" },
  { value: "recibo_sueldo", label: "Recibo de sueldo" },
  { value: "otra", label: "Otra" },
  { value: "ninguna", label: "Sin garantía" },
];

export interface FormOptions {
  properties: Array<{ id: string; address: string; zone: string | null; city: string | null; type: string | null }>;
  tenants: Array<{ id: string; fullName: string; idType: string; idNumber: string; phone: string | null; email: string | null }>;
  owners: Array<{ id: string; fullName: string; idType: string; idNumber: string | null }>;
  additionals: Array<{ id: string; name: string; defaultAmount: number | null }>;
}

interface PersonDraft {
  fullName: string;
  idType: "dni" | "cuit";
  idNumber: string;
  phone: string;
  email: string;
}

const emptyPerson = (): PersonDraft => ({ fullName: "", idType: "dni", idNumber: "", phone: "", email: "" });

function addMonths(iso: string, months: number) {
  return DateTime.fromISO(iso, { zone: "utc" }).plus({ months }).toISODate() ?? iso;
}

/** Primer vencimiento: el día pactado del mes de inicio, o del mes siguiente si ya pasó. */
function firstDue(start: string, day: number) {
  if (!start || !day) return start;
  const s = DateTime.fromISO(start, { zone: "utc" });
  const sameMonth = s.set({ day: Math.min(day, s.daysInMonth ?? 28) });
  if (sameMonth >= s) return sameMonth.toISODate()!;
  const next = s.plus({ months: 1 }).startOf("month");
  return next.set({ day: Math.min(day, next.daysInMonth ?? 28) }).toISODate()!;
}

function countDues(first: string, end: string) {
  if (!first || !end || first > end) return 0;
  let n = 0;
  let d = DateTime.fromISO(first, { zone: "utc" });
  const e = DateTime.fromISO(end, { zone: "utc" });
  while (d <= e && n < 240) {
    n++;
    d = d.plus({ months: 1 });
  }
  return n;
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function ContractForm({ options, initial }: { options: FormOptions; initial?: ContractDossier }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);

  // Partes
  const [propertyId, setPropertyId] = useState<string | null>(initial?.property.id ?? null);
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [tenantId, setTenantId] = useState<string | null>(initial?.tenant.id ?? null);
  const [newTenant, setNewTenant] = useState<PersonDraft | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(initial?.owner?.id ?? null);
  const [newOwner, setNewOwner] = useState<PersonDraft | null>(null);

  // Plazo y monto
  const start0 = todayISO().slice(0, 8) + "01";
  const [startDate, setStartDate] = useState(initial?.startDate ?? start0);
  const [endDate, setEndDate] = useState(initial?.endDate ?? addMonths(start0, 24).slice(0, 8) + "01");
  const [dueDay, setDueDay] = useState<number>(initial?.dueDay ?? 10);
  const [amount, setAmount] = useState<number | null>(initial?.baseAmount ?? null);
  const [currency, setCurrency] = useState<"ARS" | "USD">((initial?.currency as "ARS" | "USD") ?? "ARS");
  const [grace, setGrace] = useState<number>(initial?.gracePeriodDays ?? 0);

  // Aumentos
  const [every, setEvery] = useState(initial?.adjustment.everyMonths ? String(initial.adjustment.everyMonths) : "3");
  const [customEvery, setCustomEvery] = useState("");
  const [index, setIndex] = useState(initial?.adjustment.index ?? "IPC");
  const [nextAdjust, setNextAdjust] = useState(initial?.adjustment.nextDate ?? "");

  // Qué incluye
  const [extras, setExtras] = useState<Array<{ additionalId: string; name: string; amount: number }>>([]);
  const [services, setServices] = useState<string[]>(initial?.tenantServices ?? ["Luz", "Gas", "Agua"]);
  const [customService, setCustomService] = useState("");

  // Garantía, depósito, anticipo, honorarios
  const [guarantee, setGuarantee] = useState(initial?.guaranteeType ?? "");
  const [guaranteeDetail, setGuaranteeDetail] = useState(initial?.guaranteeDetail ?? "");
  const [deposit, setDeposit] = useState<number | null>(initial?.depositAmount ?? null);
  const [advance, setAdvance] = useState<number | null>(initial?.advanceAmount ?? null);
  const [advanceDetail, setAdvanceDetail] = useState(initial?.advanceDetail ?? "");
  const [fee, setFee] = useState<number>(initial?.feePercent ?? 5);

  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [attachments, setAttachments] = useState<RentalAttachment[]>(
    Array.isArray(initial?.attachments) ? (initial.attachments as RentalAttachment[]) : [],
  );
  const urls = useSignedUrls(attachments.map((a) => a.path));

  const everyMonths = every === "otro" ? Number.parseInt(customEvery, 10) || null : every ? Number(every) : null;
  const first = firstDue(startDate, dueDay);
  const dueCount = countDues(first, endDate);
  const autoNextAdjust = everyMonths && startDate ? addMonths(startDate, everyMonths) : "";
  const preview = splitCharges(
    [{ kind: "rent", label: "Alquiler", amount: amount ?? 0 }, ...extras.map((x) => ({ kind: "additional" as const, label: x.name, amount: x.amount }))],
    fee,
  );

  const propertyItems: PickerItem[] = useMemo(
    () => options.properties.map((p) => ({ id: p.id, label: p.address, sub: [p.type, p.zone, p.city].filter(Boolean).join(" · ") })),
    [options.properties],
  );
  const tenantItems: PickerItem[] = useMemo(
    () => options.tenants.map((t) => ({ id: t.id, label: t.fullName, sub: `${t.idType.toUpperCase()} ${t.idNumber}${t.phone ? ` · ${t.phone}` : ""}` })),
    [options.tenants],
  );
  const ownerItems: PickerItem[] = useMemo(
    () => options.owners.map((o) => ({ id: o.id, label: o.fullName, sub: o.idNumber ? `${o.idType.toUpperCase()} ${o.idNumber}` : null })),
    [options.owners],
  );

  function toggleService(s: string) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function createPerson(kind: "inquilinos" | "propietarios", p: PersonDraft) {
    const data = await api<{ id: string }>(`/api/${kind}`, {
      method: "POST",
      json: { fullName: p.fullName, idType: p.idType, idNumber: p.idNumber, phone: p.phone || null, email: p.email || null },
    });
    return data.id;
  }

  function validate(): string | null {
    if (editing) return null;
    if (!propertyId) return "Elegí la propiedad";
    if (!tenantId && !newTenant) return "Elegí o cargá el inquilino";
    if (newTenant && (!newTenant.fullName.trim() || !newTenant.idNumber.trim())) return "Completá nombre y DNI/CUIT del inquilino";
    if (newOwner && !newOwner.fullName.trim()) return "Completá el nombre del propietario";
    if (!amount || amount <= 0) return "Indicá el monto del alquiler";
    if (!startDate || !endDate || startDate >= endDate) return "Revisá las fechas del contrato";
    if (dueCount === 0) return "Con esas fechas no se genera ningún vencimiento";
    return null;
  }

  async function submit() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const resolvedOwner = newOwner ? await createPerson("propietarios", newOwner) : ownerId;
      const conditions = {
        ownerId: resolvedOwner,
        unit: unit || null,
        feePercent: fee,
        dueDay,
        adjustmentEveryMonths: everyMonths,
        adjustmentIndex: everyMonths ? index : null,
        adjustmentNextDate: everyMonths ? nextAdjust || autoNextAdjust || null : null,
        tenantServices: services,
        guaranteeType: guarantee || null,
        guaranteeDetail: guaranteeDetail || null,
        depositAmount: deposit,
        advanceAmount: advance,
        advanceDetail: advanceDetail || null,
        notes,
        attachments,
      };
      if (editing && initial) {
        await api(`/api/alquileres/${initial.id}`, { method: "PATCH", json: { ...conditions, gracePeriodDays: grace } });
        toast.success("Condiciones guardadas");
        router.push(`/alquileres/${initial.id}`);
        router.refresh();
        return;
      }
      const resolvedTenant = newTenant ? await createPerson("inquilinos", newTenant) : tenantId;
      const created = await api<{ id: string }>("/api/alquileres", {
        method: "POST",
        json: {
          ...conditions,
          propertyId,
          tenantId: resolvedTenant,
          startDate,
          endDate,
          firstDueDate: first,
          frequency: "mensual",
          baseAmount: amount,
          currency,
          gracePeriodDays: grace,
          additionals: extras.map((x) => ({ additionalId: x.additionalId, amount: x.amount })),
        },
      });
      toast.success(`Contrato cargado · ${dueCount} vencimientos generados`);
      router.push(`/alquileres/${created.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-24">
      <Link
        href={editing && initial ? `/alquileres/${initial.id}` : "/alquileres/contratos"}
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-text-faint hover:text-text"
      >
        <IconArrowLeft size={15} /> {editing ? "Volver al legajo" : "Contratos"}
      </Link>
      <header>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-text md:text-[28px]">
          {editing ? "Condiciones del contrato" : "Nuevo contrato de alquiler"}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-text-faint">
          {editing && initial
            ? `${initial.property.address}${initial.unit ? ` · ${initial.unit}` : ""} · ${initial.tenant.fullName}`
            : "Lo que pactaron las partes: cada contrato tiene sus propias condiciones."}
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 1. Partes */}
        <FormSection title="Propiedad y partes">
          {editing && initial ? (
            <Locked
              rows={[
                ["Propiedad", initial.property.address],
                ["Inquilino", initial.tenant.fullName],
              ]}
            />
          ) : (
            <>
              <Field label="Propiedad">
                <SearchPicker
                  items={propertyItems}
                  value={propertyId}
                  onChange={setPropertyId}
                  placeholder="Buscá por dirección"
                  ariaLabel="Propiedad"
                  emptyText="No hay propiedades con esa dirección. Cargala primero en Propiedades."
                />
              </Field>
            </>
          )}
          <Field label="Piso y depto / unidad" hint="Se imprime en el recibo. Ej.: Piso 4 · Dto B">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputBox} placeholder="Opcional" />
          </Field>
          {!editing && (
            <PersonPicker
              label="Inquilino"
              items={tenantItems}
              value={tenantId}
              onChange={setTenantId}
              draft={newTenant}
              onDraft={setNewTenant}
              requireId
            />
          )}
          <PersonPicker label="Propietario" items={ownerItems} value={ownerId} onChange={setOwnerId} draft={newOwner} onDraft={setNewOwner} />
        </FormSection>

        {/* 2. Plazo y monto */}
        <FormSection title="Plazo y monto">
          {editing && initial ? (
            <Locked
              rows={[
                ["Plazo", `${dateAR(initial.startDate)} → ${dateAR(initial.endDate)}`],
                ["Alquiler actual", money(initial.baseAmount, initial.currency)],
              ]}
              note="Para cambiar el monto usá “Aplicar aumento” desde el legajo."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Inicio">
                  <DateField value={startDate} onChange={setStartDate} clearable={false} />
                </Field>
                <Field label="Fin">
                  <DateField value={endDate} onChange={setEndDate} clearable={false} />
                </Field>
              </div>
              <div className="-mt-1 flex flex-wrap gap-1.5">
                {[12, 24, 36].map((m) => (
                  <button key={m} type="button" className={btnSecondarySm} onClick={() => setEndDate(addMonths(startDate, m))}>
                    {m} meses
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Field label="Alquiler mensual">
                  <CurrencyInput value={amount} onChange={setAmount} placeholder="900.000" />
                </Field>
                <Field label="Moneda">
                  <Segmented ariaLabel="Moneda" value={currency} onChange={setCurrency} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
                </Field>
              </div>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vence el día" hint={!editing && first ? `Primer vencimiento: ${dateAR(first)}` : undefined}>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                disabled={editing}
                onChange={(e) => setDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className={`${inputBox} tabular-nums`}
              />
            </Field>
            <Field label="Días de gracia" hint="Antes de marcarlo vencido.">
              <input type="number" min={0} max={30} value={grace} onChange={(e) => setGrace(Math.max(0, Number(e.target.value) || 0))} className={`${inputBox} tabular-nums`} />
            </Field>
          </div>
        </FormSection>

        {/* 3. Aumentos */}
        <FormSection title="Aumentos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cada cuánto">
              <SelectField value={every} onChange={(e) => setEvery(e.target.value)}>
                {ADJUST_EVERY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="otro">Otro…</option>
              </SelectField>
            </Field>
            {every === "otro" ? (
              <Field label="Meses">
                <input type="number" min={1} max={36} value={customEvery} onChange={(e) => setCustomEvery(e.target.value)} className={`${inputBox} tabular-nums`} />
              </Field>
            ) : (
              <Field label="Según">
                <SelectField value={index} onChange={(e) => setIndex(e.target.value)} disabled={!everyMonths}>
                  {INDEXES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </SelectField>
              </Field>
            )}
          </div>
          {everyMonths ? (
            <Field label="Próximo aumento" hint="Ese día te avisamos a vos y al inquilino. El monto nuevo lo ponés vos.">
              <DateField value={nextAdjust || autoNextAdjust} onChange={setNextAdjust} />
            </Field>
          ) : (
            <p className="text-[12.5px] text-text-faint">Sin aumentos programados. Igual podés aplicar uno cuando quieras desde el legajo.</p>
          )}
        </FormSection>

        {/* 4. Qué se cobra */}
        <FormSection title="Qué se cobra y qué paga el inquilino">
          {!editing && (
            <Field label="Se cobra junto con el alquiler" hint="Aparecen en los recibos. Ej.: impuesto municipal, AySA.">
              <div className="flex flex-col gap-2">
                {extras.map((x) => (
                  <div key={x.additionalId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{x.name}</span>
                    <div className="w-36">
                      <CurrencyInput value={x.amount} onChange={(v) => setExtras((prev) => prev.map((p) => (p.additionalId === x.additionalId ? { ...p, amount: v ?? 0 } : p)))} />
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar ${x.name}`}
                      onClick={() => setExtras((prev) => prev.filter((p) => p.additionalId !== x.additionalId))}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-text-faint hover:bg-clay-chip hover:text-terra"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  {options.additionals
                    .filter((a) => !extras.some((x) => x.additionalId === a.id))
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={btnSecondarySm}
                        onClick={() => setExtras((prev) => [...prev, { additionalId: a.id, name: a.name, amount: a.defaultAmount ?? 0 }])}
                      >
                        <IconPlus size={13} /> {a.name}
                      </button>
                    ))}
                  {options.additionals.length === 0 && (
                    <p className="text-[12px] text-text-faint">
                      No hay conceptos cargados.{" "}
                      <Link href="/adicionales" className="font-semibold text-terra hover:underline">
                        Cargar conceptos
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </Field>
          )}
          <Field label="Servicios que paga por su cuenta" hint="Le pedimos el comprobante todos los meses desde su portal.">
            <div className="flex flex-wrap gap-x-4 gap-y-2.5 pt-1">
              {[...new Set([...SERVICES, ...services])].map((s) => (
                <Check key={s} checked={services.includes(s)} onChange={() => toggleService(s)} label={s} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customService.trim()) {
                    e.preventDefault();
                    toggleService(customService.trim());
                    setCustomService("");
                  }
                }}
                placeholder="Otro servicio"
                className={`${inputBox} h-10`}
              />
              <button
                type="button"
                className={btnSecondarySm + " h-10 shrink-0"}
                disabled={!customService.trim()}
                onClick={() => {
                  toggleService(customService.trim());
                  setCustomService("");
                }}
              >
                Agregar
              </button>
            </div>
          </Field>
        </FormSection>

        {/* 5. Garantía, depósito, anticipo */}
        <FormSection title="Garantía, depósito y anticipo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Garantía">
              <SelectField value={guarantee} onChange={(e) => setGuarantee(e.target.value)}>
                {GUARANTEES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Detalle de la garantía">
              <input value={guaranteeDetail} onChange={(e) => setGuaranteeDetail(e.target.value)} placeholder="Garante, póliza, inmueble…" className={inputBox} />
            </Field>
            <Field label="Depósito">
              <CurrencyInput value={deposit} onChange={setDeposit} placeholder="0" />
            </Field>
            <Field label="Anticipo">
              <CurrencyInput value={advance} onChange={setAdvance} placeholder="0" />
            </Field>
          </div>
          {advance ? (
            <Field label="Detalle del anticipo">
              <input value={advanceDetail} onChange={(e) => setAdvanceDetail(e.target.value)} placeholder="Ej.: primer mes adelantado" className={inputBox} />
            </Field>
          ) : null}
        </FormSection>

        {/* 6. Honorarios + notas */}
        <FormSection title="Honorarios y notas">
          <Field label="Honorarios de administración" hint="Se descuentan del alquiler en el recibo al propietario. Se puede cambiar en cada cobro.">
            <div className="relative w-32">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={fee}
                onChange={(e) => setFee(e.target.value === "" ? 0 : Number(e.target.value))}
                className={`${inputBox} pr-8 tabular-nums`}
                aria-label="Porcentaje de honorarios"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-text-faint">%</span>
            </div>
          </Field>
          <Field label="Notas del contrato" hint="Acuerdos entre partes, referencias, lo que haga falta recordar.">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaBox} />
          </Field>
          <Field label="Contrato firmado y documentos">
            <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={urls} compact />
          </Field>
        </FormSection>
      </div>

      {/* Barra fija: resumen + guardar */}
      <div data-form-bar className="fixed inset-x-3 bottom-[calc(var(--safe-bottom,0px)+92px)] z-30 rounded-[20px] border border-border bg-surface px-4 py-3 shadow-[0_18px_40px_-20px_rgba(27,25,22,0.35)] md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:px-6 md:shadow-none lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[12.5px] text-text-muted">
            {editing ? (
              "Los cambios valen para los próximos cobros."
            ) : (
              <>
                <span className="font-semibold text-text">{dueCount} vencimientos</span>
                {amount ? (
                  <span className="hidden sm:inline">
                    {" "}
                    · inquilino paga {money(preview.tenantTotal, currency)} · propietario recibe {money(preview.ownerTotal, currency)}
                  </span>
                ) : null}
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link href={editing && initial ? `/alquileres/${initial.id}` : "/alquileres/contratos"} className={btnText}>
              Cancelar
            </Link>
            <button type="button" className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "Guardando…" : editing ? "Guardar condiciones" : "Cargar contrato"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <h2 className="font-display text-base font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function Locked({ rows, note }: { rows: Array<[string, string]>; note?: string }) {
  return (
    <div className="rounded-[16px] bg-bg px-4 py-3">
      <dl className="grid gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-[13px]">
            <dt className="text-text-faint">{k}</dt>
            <dd className="text-right font-semibold text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-[11.5px] text-text-faint">{note}</p>}
    </div>
  );
}

function PersonPicker({
  label,
  items,
  value,
  onChange,
  draft,
  onDraft,
  requireId,
}: {
  label: string;
  items: PickerItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  draft: PersonDraft | null;
  onDraft: (d: PersonDraft | null) => void;
  requireId?: boolean;
}) {
  if (draft) {
    const set = (patch: Partial<PersonDraft>) => onDraft({ ...draft, ...patch });
    return (
      <fieldset className="flex flex-col gap-3 rounded-[16px] bg-bg p-3.5">
        <legend className="sr-only">{`Nuevo ${label.toLowerCase()}`}</legend>
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] font-semibold text-text-muted">{`Nuevo ${label.toLowerCase()}`}</p>
          <button type="button" className={btnText} onClick={() => onDraft(null)}>
            Elegir uno existente
          </button>
        </div>
        <input value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Nombre y apellido" className={inputBox} aria-label="Nombre y apellido" />
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Segmented ariaLabel="Tipo de documento" size="sm" value={draft.idType} onChange={(v) => set({ idType: v })} options={[{ value: "dni", label: "DNI" }, { value: "cuit", label: "CUIT" }]} />
          <input
            value={draft.idNumber}
            onChange={(e) => set({ idNumber: e.target.value })}
            placeholder={requireId ? "Número" : "Número (opcional)"}
            inputMode="numeric"
            className={inputBox}
            aria-label="Número de documento"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Teléfono" inputMode="tel" className={inputBox} aria-label="Teléfono" />
          <input value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="Email" inputMode="email" className={inputBox} aria-label="Email" />
        </div>
      </fieldset>
    );
  }
  return (
    <Field label={label}>
      <SearchPicker
        items={items}
        value={value}
        onChange={onChange}
        placeholder={`Buscá por nombre${requireId ? " o DNI" : ""}`}
        ariaLabel={label}
        footer={
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onDraft(emptyPerson())} className="flex w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-left text-[12.5px] font-semibold text-terra hover:bg-bg">
            <IconPlus size={14} /> {`Cargar ${label.toLowerCase()} nuevo`}
          </button>
        }
      />
      {!value && (
        <button type="button" onClick={() => onDraft(emptyPerson())} className="mt-1 w-fit text-[12px] font-semibold text-terra hover:underline">
          {`+ ${label} nuevo`}
        </button>
      )}
    </Field>
  );
}
