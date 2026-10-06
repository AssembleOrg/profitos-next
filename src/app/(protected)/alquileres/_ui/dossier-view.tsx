"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContractDossier, DossierDue, PaymentDTO, ServiceProofDTO } from "@/lib/rentals/dto";
import { formatReceiptNo } from "@/lib/rentals/money";
import { useSignedUrls } from "../_components/use-signed-urls";
import { AttachmentPreview } from "../_components/media-uploader";
import type { RentalAttachment } from "../_components/voice-recorder";
import { CollectSheet } from "./collect-sheet";
import { AdjustmentSheet, type AdjustmentTarget } from "./adjustment-sheet";
import { DueEditSheet } from "./due-edit-sheet";
import { ProofSheet } from "./proof-sheet";
import { PortalAccessSheet, type PortalAccessTarget } from "./portal-access-sheet";
import { useReasonSheet } from "./reason-sheet";
import {
  IconArrowLeft,
  IconChevronDown,
  IconFlag,
  IconKey,
  IconPencil,
  IconReceipt,
  IconTrend,
  IconUpload,
  IconWhatsApp,
} from "./icons";
import {
  AdjustPill,
  Card,
  ContractPill,
  DuePill,
  Pill,
  SectionTitle,
  api,
  btnGold,
  btnPrimary,
  btnPrimarySm,
  btnSecondary,
  btnSecondarySm,
  dateAR,
  initials,
  money,
  propertyLine,
} from "./kit";
import { capitalize, monthLabel } from "./format";

const GUARANTEE_LABEL: Record<string, string> = {
  propietaria: "Garantía propietaria",
  seguro_caucion: "Seguro de caución",
  recibo_sueldo: "Recibo de sueldo",
  otra: "Otra garantía",
  ninguna: "Sin garantía",
};

function waLink(phone: string | null, text = "") {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("54") ? digits : `54${digits}`}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function DossierView({ d, today }: { d: ContractDossier; today: string }) {
  const router = useRouter();
  const [collectDue, setCollectDue] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<AdjustmentTarget | null>(null);
  const [editDue, setEditDue] = useState<DossierDue | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [portal, setPortal] = useState<PortalAccessTarget | null>(null);
  const refresh = () => router.refresh();

  const nextOpen = d.dues.find((x) => x.status !== "pagado" && x.status !== "condonado");
  const adjustTarget: AdjustmentTarget = {
    contractId: d.id,
    date: d.adjustment.nextDate,
    index: d.adjustment.index,
    everyMonths: d.adjustment.everyMonths,
    currentAmount: d.baseAmount,
    currency: d.currency,
    address: d.property.address,
    unit: d.unit,
    tenantName: d.tenant.fullName,
  };
  const wa = waLink(d.tenant.phone);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/alquileres/contratos" className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-text-faint hover:text-text">
        <IconArrowLeft size={15} /> Contratos
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold leading-tight text-text md:text-[30px]">{propertyLine(d.property.address, d.unit)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-text-faint">
            <span>
              {[d.property.zone, d.property.city].filter(Boolean).join(", ") || "Sin localidad"} · {dateAR(d.startDate)} → {dateAR(d.endDate)}
            </span>
            <ContractPill status={d.status} />
            {d.kind === "temporal" && <Pill tone="bg-info-chip text-info">Temporal</Pill>}
            <AdjustPill alert={d.status === "finalizado" ? "none" : d.adjustment.alert} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextOpen && d.kind !== "temporal" && (
            <button type="button" className={btnPrimary} onClick={() => setCollectDue(nextOpen.id)}>
              <IconReceipt size={16} className="text-accent" />
              Cobrar {monthLabel(nextOpen.dueDate.slice(0, 7)).toLowerCase()}
            </button>
          )}
          {nextOpen && d.kind === "temporal" && (
            <button type="button" className={btnPrimary} onClick={() => setCollectDue(nextOpen.id)}>
              <IconReceipt size={16} className="text-accent" />
              Cobrar cuota {nextOpen.position}
            </button>
          )}
          {d.status !== "finalizado" && (
            <button type="button" className={btnSecondary} onClick={() => setAdjust(adjustTarget)}>
              <IconTrend size={16} />
              Aplicar aumento
            </button>
          )}
          <Link href={`/alquileres/${d.id}/editar`} className={btnSecondary}>
            <IconPencil size={16} />
            Condiciones
          </Link>
        </div>
      </header>

      {/* Partes + condiciones */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr]">
        <Card>
          <PartyHeader role="Inquilino" name={d.tenant.fullName} tone="bg-sand-chip" />
          <PartyLines idType={d.tenant.idType} idNumber={d.tenant.idNumber} phone={d.tenant.phone} email={d.tenant.email} />
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              className={btnSecondarySm}
              onClick={() =>
                setPortal({
                  tenantId: d.tenant.id,
                  fullName: d.tenant.fullName,
                  email: d.tenant.email,
                  phone: d.tenant.phone,
                  ...d.tenantPortal,
                })
              }
            >
              <IconKey size={14} />
              {d.tenantPortal.enabled ? "Portal activo" : "Dar acceso al portal"}
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className={btnSecondarySm}>
                <IconWhatsApp size={14} /> WhatsApp
              </a>
            )}
          </div>
        </Card>
        <Card>
          {d.owner ? (
            <>
              <PartyHeader role="Propietario" name={d.owner.fullName} tone="bg-sage-chip" />
              <PartyLines idType={d.owner.idType} idNumber={d.owner.idNumber} phone={d.owner.phone} email={d.owner.email} />
            </>
          ) : (
            <div className="flex h-full flex-col justify-center gap-2">
              <p className="font-display text-[15px] font-semibold text-text">Sin propietario cargado</p>
              <p className="text-[12.5px] text-text-faint">Lo necesitás para el recibo al propietario.</p>
              <Link href={`/alquileres/${d.id}/editar`} className="text-[12.5px] font-semibold text-terra hover:underline">
                Agregar propietario
              </Link>
            </div>
          )}
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Cond label="Alquiler actual" value={money(d.baseAmount, d.currency)} big />
            <Cond label="Honorarios" value={`${d.feePercent}% del alquiler`} />
            <Cond
              label="Aumentos"
              value={
                d.adjustment.everyMonths || d.adjustment.index
                  ? [d.adjustment.everyMonths ? `Cada ${d.adjustment.everyMonths} meses` : null, d.adjustment.index].filter(Boolean).join(" · ")
                  : "Sin aumentos pactados"
              }
              sub={d.adjustment.nextDate ? `Próximo: ${dateAR(d.adjustment.nextDate)}` : undefined}
            />
            <Cond label="Vence" value={d.dueDay ? `El ${d.dueDay} de cada mes` : `Desde ${dateAR(d.firstDueDate)}`} sub={d.gracePeriodDays ? `${d.gracePeriodDays} días de gracia` : undefined} />
            <Cond
              label="Paga por su cuenta"
              value={d.tenantServices.length ? d.tenantServices.join(", ") : "Ningún servicio"}
            />
            <Cond
              label="Garantía"
              value={d.guaranteeType ? GUARANTEE_LABEL[d.guaranteeType] ?? d.guaranteeType : "Sin cargar"}
              sub={d.guaranteeDetail ?? undefined}
            />
            <Cond label="Depósito" value={d.depositAmount ? money(d.depositAmount, d.currency) : "—"} />
            <Cond label="Anticipo" value={d.advanceAmount ? money(d.advanceAmount, d.currency) : "—"} sub={d.advanceDetail ?? undefined} />
          </dl>
          {d.additionals.length > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-text-faint">
              Se cobra con el alquiler: {d.additionals.map((a) => `${a.name} ${money(a.amount, d.currency)}`).join(" · ")}
            </p>
          )}
        </Card>
      </div>

      <Ledger d={d} today={today} onCollect={setCollectDue} onEdit={setEditDue} onChanged={refresh} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ProofsCard proofs={d.proofs} services={d.tenantServices} onAdd={() => setProofOpen(true)} onChanged={refresh} />
        <div className="flex flex-col gap-4">
          <AdjustmentsCard d={d} onApply={() => setAdjust(adjustTarget)} />
          {(d.notes || (Array.isArray(d.attachments) && d.attachments.length > 0)) && <NotesCard d={d} />}
        </div>
      </div>

      <CollectSheet dueId={collectDue} open={Boolean(collectDue)} onClose={() => setCollectDue(null)} onDone={refresh} />
      <AdjustmentSheet target={adjust} onClose={() => setAdjust(null)} onDone={refresh} />
      <DueEditSheet due={editDue} currency={d.currency} onClose={() => setEditDue(null)} onDone={refresh} />
      <ProofSheet
        contractId={d.id}
        services={d.tenantServices}
        defaultPeriod={today.slice(0, 7)}
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        onDone={refresh}
      />
      <PortalAccessSheet target={portal} onClose={() => setPortal(null)} onChanged={refresh} />
    </div>
  );
}

function PartyHeader({ role, name, tone }: { role: string; name: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold text-text-muted ${tone}`}>
        {initials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-[16px] font-semibold text-text">{name}</p>
        <p className="text-[12px] text-text-faint">{role}</p>
      </div>
    </div>
  );
}

function PartyLines({ idType, idNumber, phone, email }: { idType: string | null; idNumber: string | null; phone: string | null; email: string | null }) {
  return (
    <dl className="mt-3 grid gap-1 text-[12.5px]">
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-text-faint">{(idType ?? "DNI").toUpperCase()}</dt>
        <dd className="tabular-nums text-text">{idNumber || "—"}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-text-faint">Teléfono</dt>
        <dd className="tabular-nums text-text">{phone || "—"}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-text-faint">Email</dt>
        <dd className="truncate text-text">{email || "—"}</dd>
      </div>
    </dl>
  );
}

function Cond({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-text-faint">{label}</dt>
      <dd className={big ? "font-display text-[20px] font-bold tabular-nums leading-tight text-text" : "text-[13px] font-semibold text-text"}>{value}</dd>
      {sub && <dd className="text-[11.5px] text-text-faint">{sub}</dd>}
    </div>
  );
}

/** La planilla de la inmobiliaria, mes a mes: inquilino → honorarios → propietario. */
function Ledger({
  d,
  today,
  onCollect,
  onEdit,
  onChanged,
}: {
  d: ContractDossier;
  today: string;
  onCollect: (id: string) => void;
  onEdit: (due: DossierDue) => void;
  onChanged: () => void;
}) {
  const currentMonth = today.slice(0, 7);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Link desde la agenda (#cuota-<id>): abrir esa cuota después de montar.
  useEffect(() => {
    const id = window.location.hash.replace("#cuota-", "");
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      setOpen(id);
      setShowAll(true);
      requestAnimationFrame(() => {
        const el = [document.getElementById(`cuota-${id}`), document.getElementById(`cuota-m-${id}`)].find((x) => x && x.offsetParent);
        el?.scrollIntoView({ block: "center" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Por defecto: 3 meses atrás, el actual y los próximos 3, más cualquier deuda.
  const visible = useMemo(() => {
    if (showAll || d.dues.length <= 9) return d.dues;
    const idx = d.dues.findIndex((x) => x.dueDate.slice(0, 7) >= currentMonth);
    const center = idx === -1 ? d.dues.length - 1 : idx;
    const from = Math.max(0, center - 3);
    const to = Math.min(d.dues.length, center + 4);
    return d.dues.filter((x, i) => (i >= from && i < to) || x.status === "vencido" || x.status === "parcial");
  }, [d.dues, showAll, currentMonth]);

  const adjustmentMonths = new Map(d.adjustments.map((a) => [a.effectiveDate.slice(0, 7), a]));

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 md:px-5">
        <h2 className="font-display text-base font-semibold text-text">Cuenta mes a mes</h2>
        <p className="text-[12px] text-text-faint">
          Cobrado {money(d.totals.collected, d.currency)} · honorarios {money(d.totals.fees, d.currency)} · rendido {money(d.totals.toOwner, d.currency)}
        </p>
      </div>
      {/* Mobile: una tarjeta por mes */}
      <ul className="flex flex-col divide-y divide-border border-t border-border md:hidden">
        {visible.map((due) => {
          const month = due.dueDate.slice(0, 7);
          const isCurrent = month === currentMonth;
          const future = month > currentMonth;
          const fee = due.payments.reduce((a, p) => a + p.commissionAmount, 0);
          const owner = due.payments.reduce((a, p) => a + p.ownerAmount, 0);
          const adj = adjustmentMonths.get(month);
          const expanded = open === due.id;
          return (
            <li key={due.id} id={`cuota-m-${due.id}`} className={`px-4 py-3 ${isCurrent ? "bg-sand-chip/40" : ""}`}>
              {adj && (
                <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-text">
                  <IconFlag size={12} className="text-accent" />
                  Aumento: {money(adj.previousAmount, d.currency)} → {money(adj.newAmount, d.currency)}
                </p>
              )}
              <button type="button" onClick={() => setOpen(expanded ? null : due.id)} aria-expanded={expanded} className="flex w-full items-start justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-bold ${future ? "text-text-muted" : "text-text"}`}>{capitalize(monthLabel(month))}</span>
                  <span className="block text-[11.5px] tabular-nums text-text-faint">vence {dateAR(due.dueDate)}</span>
                </span>
                <DuePill status={due.status} />
              </button>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-[18px] font-bold tabular-nums text-text">{money(due.expected, d.currency)}</p>
                  <p className="text-[11.5px] text-text-faint">
                    {fee ? `Honorarios ${money(fee, d.currency)} · propietario ${money(owner, d.currency)}` : `Alquiler ${money(due.rent, d.currency)}`}
                  </p>
                </div>
                {due.status !== "pagado" && due.status !== "condonado" && !future && (
                  <button type="button" className={btnPrimarySm} onClick={() => onCollect(due.id)}>
                    Cobrar
                  </button>
                )}
              </div>
              {expanded && (
                <div className="mt-3">
                  <DueDetail due={due} currency={d.currency} onCollect={() => onCollect(due.id)} onEdit={() => onEdit(due)} onChanged={onChanged} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-t border-border">
              {["Mes", "Alquiler", "Adicionales", "Inquilino paga", "Honorarios", "Propietario", "Estado", ""].map((h, i) => (
                <th key={i} scope="col" className={`px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint first:pl-4 md:first:pl-5 ${i >= 1 && i <= 5 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((due) => {
              const month = due.dueDate.slice(0, 7);
              const isCurrent = month === currentMonth;
              const future = month > currentMonth;
              const extras = due.lines.filter((l) => l.included).reduce((a, l) => a + l.amount, 0);
              const fee = due.payments.reduce((a, p) => a + p.commissionAmount, 0);
              const owner = due.payments.reduce((a, p) => a + p.ownerAmount, 0);
              const adj = adjustmentMonths.get(month);
              const expanded = open === due.id;
              return (
                <Fragment key={due.id}>
                  {adj && (
                    <tr className="border-t border-border bg-sand-chip/50">
                      <td colSpan={8} className="px-4 py-1.5 text-[11.5px] font-semibold text-text md:px-5">
                        <IconFlag size={12} className="mr-1.5 inline text-accent" />
                        Aumento {adj.indexLabel ?? ""}: {money(adj.previousAmount, d.currency)} → {money(adj.newAmount, d.currency)}
                      </td>
                    </tr>
                  )}
                  <tr
                    id={`cuota-${due.id}`}
                    className={`border-t border-border transition-colors ${isCurrent ? "bg-sand-chip/40" : ""} ${future ? "text-text-faint" : ""} ${expanded ? "bg-bg" : "hover:bg-bg"}`}
                  >
                    <td className="whitespace-nowrap py-2.5 pl-4 pr-3 md:pl-5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : due.id)}
                        aria-expanded={expanded}
                        className="flex items-center gap-1.5 text-left"
                      >
                        <IconChevronDown size={14} className={`shrink-0 text-text-faint transition-transform ${expanded ? "rotate-180" : ""}`} />
                        <span>
                          <span className={`block text-[13px] font-bold ${future ? "text-text-muted" : "text-text"}`}>{capitalize(monthLabel(month))}</span>
                          <span className="block text-[11px] tabular-nums text-text-faint">vence {dateAR(due.dueDate)}</span>
                        </span>
                      </button>
                    </td>
                    <Num v={due.rent} c={d.currency} />
                    <Num v={extras} c={d.currency} dim={!extras} />
                    <Num v={due.expected} c={d.currency} strong />
                    <Num v={fee} c={d.currency} dim={!fee} neg />
                    <Num v={owner} c={d.currency} dim={!owner} />
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <DuePill status={due.status} />
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right md:pr-5">
                      {due.status !== "pagado" && due.status !== "condonado" && !future ? (
                        <button type="button" className={btnPrimarySm} onClick={() => onCollect(due.id)}>
                          Cobrar
                        </button>
                      ) : (
                        <button type="button" className="text-[12.5px] font-semibold text-terra hover:underline" onClick={() => setOpen(expanded ? null : due.id)}>
                          {due.payments.length ? "Recibos" : "Detalle"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-bg">
                      <td colSpan={8} className="px-4 pb-4 pt-1 md:px-5">
                        <DueDetail due={due} currency={d.currency} onCollect={() => onCollect(due.id)} onEdit={() => onEdit(due)} onChanged={onChanged} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {d.dues.length > visible.length && (
        <div className="border-t border-border px-4 py-3 text-center md:px-5">
          <button type="button" className="text-[12.5px] font-semibold text-terra hover:underline" onClick={() => setShowAll(true)}>
            Ver las {d.dues.length} cuotas del contrato
          </button>
        </div>
      )}
    </Card>
  );
}

function Num({ v, c, strong, dim, neg }: { v: number; c: string; strong?: boolean; dim?: boolean; neg?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 text-right text-[13px] tabular-nums ${strong ? "font-display font-bold text-text" : dim ? "text-text-faint" : "text-text-muted"}`}>
      {dim ? "—" : `${neg ? "− " : ""}${money(v, c)}`}
    </td>
  );
}

function DueDetail({
  due,
  currency,
  onCollect,
  onEdit,
  onChanged,
}: {
  due: DossierDue;
  currency: string;
  onCollect: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pl-5">
      {due.payments.length === 0 ? (
        <p className="text-[12.5px] text-text-faint">Todavía no hay cobros en esta cuota.</p>
      ) : (
        due.payments.map((p) => <PaymentRow key={p.id} p={p} dueId={due.id} currency={currency} onChanged={onChanged} />)
      )}
      {due.notes && <p className="rounded-[12px] bg-bg px-3 py-2 text-[12.5px] text-text-muted">{due.notes}</p>}
      <div className="flex flex-wrap gap-2">
        {due.status !== "pagado" && due.status !== "condonado" && (
          <button type="button" className={btnPrimarySm} onClick={onCollect}>
            <IconReceipt size={14} className="text-accent" /> Cobrar
          </button>
        )}
        <button type="button" className={btnSecondarySm} onClick={onEdit}>
          <IconPencil size={14} /> Ajustar cuota
        </button>
      </div>
    </div>
  );
}

function PaymentRow({ p, dueId, currency, onChanged }: { p: PaymentDTO; dueId: string; currency: string; onChanged: () => void }) {
  const legacyUrls = useSignedUrls(p.legacyReceipt?.path ? [p.legacyReceipt.path] : []);
  const [busy, setBusy] = useState(false);
  const [dialog, ask] = useReasonSheet();

  async function voidReceipt(id: string, label: string) {
    const reason = await ask({
      title: `Anular recibo ${label}`,
      description: "El número queda anulado en el talonario y no se reutiliza. El cobro sigue registrado.",
      confirmLabel: "Anular recibo",
      reason: "required",
      placeholder: "Ej.: se emitió con un monto equivocado",
      danger: true,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await api(`/api/alquileres/recibos/${id}/anular`, { method: "POST", json: { reason } });
      toast.success(`Recibo ${label} anulado`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular");
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment() {
    const ok = await ask({
      title: "Eliminar cobro",
      description: "La cuota vuelve a quedar pendiente y sus recibos quedan anulados en el talonario.",
      confirmLabel: "Eliminar cobro",
      reason: "none",
      danger: true,
    });
    if (ok === null) return;
    setBusy(true);
    try {
      await api(`/api/alquileres/vencimientos/${dueId}/pagos/${p.id}`, { method: "DELETE" });
      toast.success("Cobro eliminado");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
      {dialog}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-text">
          <span className="font-display font-bold tabular-nums">{money(p.amountPaid, currency)}</span>
          <span className="text-text-faint">
            {" "}
            · {dateAR(p.paidAt)} · {p.method ?? "sin medio"} · {p.isFull ? "pago total" : "a cuenta"} · {p.createdBy}
          </span>
        </p>
        <button type="button" disabled={busy} onClick={deletePayment} className="text-[12px] font-semibold text-text-faint hover:text-terra">
          Eliminar cobro
        </button>
      </div>
      {p.lines && (
        <p className="text-[12px] text-text-faint">
          {p.lines.map((l) => `${l.label} ${money(l.amount, currency)}`).join(" · ")}
          {p.commissionAmount > 0 && ` · honorarios ${p.feePercent ?? ""}% ${money(p.commissionAmount, currency)}`}
        </p>
      )}
      {p.receiptNotes && <p className="text-[12px] italic text-text-muted">“{p.receiptNotes}”</p>}
      <div className="flex flex-wrap gap-2">
        {p.receipts.map((r) => {
          const label = formatReceiptNo(r.pointOfSale, r.number);
          return (
            <span key={r.id} className={`inline-flex items-center gap-2 rounded-full border border-border py-1 pl-3 pr-1 text-[12px] ${r.status === "anulado" ? "bg-bg text-text-faint line-through" : "bg-surface text-text"}`}>
              {r.bookKind === "inquilino" ? "Inquilino" : "Propietario"} {label}
              {r.status === "emitido" ? (
                <>
                  <a href={`/api/alquileres/recibos/${r.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-full bg-dark px-2.5 py-0.5 text-[11px] font-bold text-dark-fg no-underline">
                    PDF
                  </a>
                  <button type="button" disabled={busy} onClick={() => voidReceipt(r.id, label)} className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-text-faint hover:bg-clay-chip hover:text-terra">
                    Anular
                  </button>
                </>
              ) : (
                <span className="pr-2 text-[11px] no-underline">anulado</span>
              )}
            </span>
          );
        })}
        {p.legacyReceipt && (
          <a
            href={p.legacyReceipt.path ? legacyUrls[p.legacyReceipt.path] ?? "#" : "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-text-muted hover:text-text"
          >
            <IconReceipt size={13} /> Comprobante anterior #{p.legacyReceipt.number}
          </a>
        )}
      </div>
    </div>
  );
}

function ProofsCard({ proofs, services, onAdd, onChanged }: { proofs: ServiceProofDTO[]; services: string[]; onAdd: () => void; onChanged: () => void }) {
  const paths = proofs.flatMap((p) => (Array.isArray(p.attachments) ? (p.attachments as RentalAttachment[]).map((a) => a.path) : []));
  const urls = useSignedUrls(paths);
  const periods = [...new Set(proofs.map((p) => p.period))].sort().reverse().slice(0, 6);
  return (
    <Card>
      <SectionTitle
        action={
          <button type="button" className={btnSecondarySm} onClick={onAdd}>
            <IconUpload size={14} /> Cargar
          </button>
        }
      >
        Comprobantes de servicios
      </SectionTitle>
      {services.length === 0 && proofs.length === 0 ? (
        <p className="text-[12.5px] text-text-faint">Este contrato no tiene servicios a cargo del inquilino.</p>
      ) : proofs.length === 0 ? (
        <p className="text-[12.5px] text-text-faint">Todavía no subió comprobantes. Paga por su cuenta: {services.join(", ")}.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {periods.map((period) => (
            <div key={period}>
              <p className="mb-1.5 text-[12px] font-semibold text-text-muted">{monthLabel(period)}</p>
              <ul className="flex flex-col divide-y divide-border">
                {proofs
                  .filter((p) => p.period === period)
                  .map((p) => (
                    <ProofRow key={p.id} p={p} urls={urls} onChanged={onChanged} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ProofRow({
  p,
  urls,
  onChanged,
  context,
  variant = "row",
}: {
  p: ServiceProofDTO;
  urls: Record<string, string>;
  onChanged: () => void;
  context?: React.ReactNode;
  variant?: "row" | "card";
}) {
  const [busy, setBusy] = useState(false);
  const [dialog, ask] = useReasonSheet();
  const atts = Array.isArray(p.attachments) ? (p.attachments as RentalAttachment[]) : [];
  async function review(status: "aprobado" | "rechazado") {
    let reviewNote: string | undefined;
    if (status === "rechazado") {
      const r = await ask({
        title: `Rechazar comprobante de ${p.service}`,
        description: "El inquilino ve el motivo en su portal y puede volver a subirlo.",
        confirmLabel: "Rechazar",
        reason: "required",
        placeholder: "Ej.: la foto no se lee, falta el mes",
        danger: true,
      });
      if (!r) return;
      reviewNote = r;
    }
    setBusy(true);
    try {
      await api(`/api/alquileres/comprobantes/${p.id}`, { method: "PATCH", json: { status, reviewNote } });
      toast.success(status === "aprobado" ? "Comprobante aprobado" : "Comprobante rechazado");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }
  const tone = p.status === "aprobado" ? "bg-sage-chip text-olive-light" : p.status === "rechazado" ? "bg-clay-chip text-terra" : "bg-sand-chip text-warning";
  const label = p.status === "aprobado" ? "Aprobado" : p.status === "rechazado" ? "Rechazado" : "A revisar";
  return (
    <li
      className={`flex flex-col gap-2 sm:flex-row sm:items-center ${
        variant === "card" ? "rounded-[18px] border border-border bg-surface p-3.5" : "py-3 first:pt-0 last:pb-0"
      }`}
    >
      {dialog}
      <div className="flex shrink-0 gap-1.5">
        {atts.slice(0, 2).map((a) => (
          <div key={a.path} className="w-14">
            <AttachmentPreview attachment={a} url={urls[a.path]} />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13.5px] font-bold text-text">{p.service}</p>
          <Pill tone={tone}>{label}</Pill>
          {!p.uploadedByTenant && <span className="text-[11px] text-text-faint">cargado por la inmobiliaria</span>}
        </div>
        {context}
        <p className="text-[12px] text-text-faint">
          {p.amount ? `${money(p.amount)} · ` : ""}subido {dateAR(p.createdAt)}
          {p.notes ? ` · “${p.notes}”` : ""}
        </p>
        {p.reviewNote && <p className="text-[12px] text-terra">{p.reviewNote}</p>}
      </div>
      {p.status === "pendiente" && (
        <div className="flex shrink-0 gap-1.5">
          <button type="button" disabled={busy} className={btnGold} onClick={() => review("aprobado")}>
            Aprobar
          </button>
          <button type="button" disabled={busy} className={btnSecondarySm} onClick={() => review("rechazado")}>
            Rechazar
          </button>
        </div>
      )}
    </li>
  );
}

function AdjustmentsCard({ d, onApply }: { d: ContractDossier; onApply: () => void }) {
  return (
    <Card>
      <SectionTitle
        action={
          d.status !== "finalizado" && d.adjustment.alert !== "none" ? (
            <button type="button" className={btnGold} onClick={onApply}>
              Aplicar aumento
            </button>
          ) : undefined
        }
      >
        Aumentos
      </SectionTitle>
      {d.adjustment.nextDate && d.status !== "finalizado" && (
        <p className="mb-3 flex items-center gap-2 text-[13px] text-text">
          <IconFlag size={15} className="text-accent" />
          Próximo aumento el {dateAR(d.adjustment.nextDate)}
          {d.adjustment.index ? ` por ${d.adjustment.index}` : ""}
        </p>
      )}
      {d.adjustments.length === 0 ? (
        <p className="text-[12.5px] text-text-faint">Todavía no se aplicaron aumentos en este contrato.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {d.adjustments.map((a) => {
            const pct = ((a.newAmount - a.previousAmount) / a.previousAmount) * 100;
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-text">
                    Desde {dateAR(a.effectiveDate)} {a.indexLabel ? `· ${a.indexLabel}` : ""}
                  </p>
                  <p className="text-[11.5px] text-text-faint">
                    {money(a.previousAmount, d.currency)} → {money(a.newAmount, d.currency)} · {a.createdBy}
                  </p>
                </div>
                <span className="shrink-0 font-display text-[14px] font-bold tabular-nums text-olive-light">
                  +{pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function NotesCard({ d }: { d: ContractDossier }) {
  const atts = Array.isArray(d.attachments) ? (d.attachments as RentalAttachment[]) : [];
  const urls = useSignedUrls(atts.map((a) => a.path));
  return (
    <Card>
      <SectionTitle>Notas y documentos</SectionTitle>
      {d.notes && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">{d.notes}</p>}
      {atts.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {atts.map((a) => (
            <AttachmentPreview key={a.path} attachment={a} url={urls[a.path]} />
          ))}
        </div>
      )}
    </Card>
  );
}
