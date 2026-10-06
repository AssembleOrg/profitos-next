"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { toast } from "sonner";
import type { PortalContract, PortalData, PortalDue } from "@/lib/rentals/portal-data";
import { Sheet } from "@/app/(protected)/_components/sheet";
import { SelectField } from "@/components/ui/select-field";
import { IconCalendar, IconCamera, IconCheck, IconDownload, IconFlag, IconReceipt, IconUpload, IconWhatsApp } from "@/app/(protected)/alquileres/_ui/icons";
import { dateAR, dayLong, money, monthLabel, propertyLine } from "@/app/(protected)/alquileres/_ui/format";

const AGENCY_WHATSAPP = "5491153854029";

const STATUS: Record<PortalDue["status"], { label: string; tone: string }> = {
  esperando: { label: "A pagar", tone: "bg-sand-chip text-warning" },
  vencido: { label: "Vencido", tone: "bg-clay-chip text-terra" },
  parcial: { label: "Pago parcial", tone: "bg-sand-chip text-warning" },
  pagado: { label: "Pagado", tone: "bg-sage-chip text-olive-light" },
  condonado: { label: "Sin cargo", tone: "bg-bg text-text-faint" },
};

function daysFrom(today: string, date: string) {
  return Math.round(DateTime.fromISO(date, { zone: "utc" }).diff(DateTime.fromISO(today, { zone: "utc" }), "days").days);
}

export function PortalHome({ firstName, data }: { firstName: string; data: PortalData }) {
  const contracts = data.contracts;
  const [activeId, setActiveId] = useState(contracts[0]?.id ?? "");
  const c = contracts.find((x) => x.id === activeId) ?? contracts[0];
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState(false);

  // Aviso de aumento: aparece una vez por cada fecha de ajuste.
  useEffect(() => {
    if (!c?.adjustment.nextDate || c.adjustment.alert === "none") return;
    const key = `portal-aumento-${c.id}-${c.adjustment.nextDate}`;
    if (window.localStorage.getItem(key)) return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(key, "1");
      setNotice(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [c?.id, c?.adjustment.nextDate, c?.adjustment.alert]);

  if (!c) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-[24px] font-semibold text-text">Hola, {firstName}</h1>
        <p className="mt-2 text-[13.5px] text-text-muted">Todavía no hay un contrato de alquiler asociado a tu cuenta. Si es un error, escribinos.</p>
        <ContactLink className="mt-5" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-text">Hola, {firstName}</h1>
        <p className="mt-0.5 text-[13px] text-text-faint">{propertyLine(c.address, c.unit)}{c.zone ? ` · ${c.zone}` : ""}</p>
      </div>

      {contracts.length > 1 && (
        <div role="tablist" aria-label="Tus alquileres" className="-mx-5 flex gap-1.5 overflow-x-auto px-5">
          {contracts.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === c.id}
              onClick={() => setActiveId(x.id)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[12.5px] ${x.id === c.id ? "bg-dark font-bold text-dark-fg" : "border border-border bg-surface text-text-muted"}`}
            >
              {x.address}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <NextPayment c={c} today={data.today} />
          {c.adjustment.alert !== "none" && c.adjustment.nextDate && <AdjustmentCard c={c} />}
          <Services c={c} today={data.today} onUpload={() => setUploadOpen(true)} />
        </div>
        <div className="flex flex-col gap-4">
          <Calendar c={c} today={data.today} />
          <Receipts c={c} />
          <ContactLink />
        </div>
      </div>

      <UploadSheet c={c} open={uploadOpen} onClose={() => setUploadOpen(false)} today={data.today} />
      <Sheet
        open={notice}
        onClose={() => setNotice(false)}
        title="Se viene un ajuste de tu alquiler"
        maxWidth="sm:max-w-md"
        footer={
          <>
            <span />
            <button type="button" onClick={() => setNotice(false)} className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg">
              Entendido
            </button>
          </>
        }
      >
        <AdjustmentText c={c} />
      </Sheet>
    </div>
  );
}

function NextPayment({ c, today }: { c: PortalContract; today: string }) {
  const n = c.next;
  if (!n) {
    return (
      <section className="flex items-center gap-4 rounded-[24px] bg-sage-chip p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-olive-light">
          <IconCheck size={22} />
        </span>
        <div>
          <p className="font-display text-[19px] font-semibold text-text">Estás al día</p>
          <p className="text-[13px] text-text-muted">No tenés pagos pendientes.</p>
        </div>
      </section>
    );
  }
  const days = daysFrom(today, n.dueDate);
  const remaining = Math.max(0, n.amount - n.collected);
  const when =
    days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : days > 1 ? `Vence en ${days} días` : days === -1 ? "Venció ayer" : `Venció hace ${-days} días`;
  return (
    <section aria-label="Próximo pago" className="rounded-[24px] bg-dark p-5 text-dark-fg md:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-dark-muted">Alquiler de {n.periodLabel.toLowerCase()}</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${days < 0 ? "bg-terra text-white" : "bg-accent text-dark"}`}>{when}</span>
      </div>
      <p className="mt-2 font-display text-[40px] font-bold leading-none tabular-nums">{money(remaining, c.currency)}</p>
      {n.collected > 0 && <p className="mt-1 text-[12.5px] text-dark-muted">Ya pagaste {money(n.collected, c.currency)} de {money(n.amount, c.currency)}</p>}
      <p className="mt-3 flex items-center gap-2 text-[13px] text-dark-muted">
        <IconCalendar size={15} className="text-accent" />
        {dayLong(n.dueDate)}
      </p>
    </section>
  );
}

function AdjustmentText({ c }: { c: PortalContract }) {
  const date = c.adjustment.nextDate!;
  return (
    <p className="text-[14px] leading-relaxed text-text-muted">
      Según tu contrato, el alquiler se ajusta {c.adjustment.everyMonths ? `cada ${c.adjustment.everyMonths} meses` : ""}
      {c.adjustment.index ? ` por ${c.adjustment.index}` : ""}. El próximo ajuste es a partir de{" "}
      <span className="font-semibold text-text">{monthLabel(date.slice(0, 7)).toLowerCase()}</span> ({dateAR(date)}). La inmobiliaria te va a confirmar
      el monto nuevo. Tu alquiler hoy es de {money(c.rent, c.currency)} (más servicios e impuestos).
    </p>
  );
}

function AdjustmentCard({ c }: { c: PortalContract }) {
  return (
    <section aria-label="Próximo ajuste" className="flex gap-3 rounded-[20px] bg-sand-chip p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
        <IconFlag size={18} />
      </span>
      <div>
        <p className="font-display text-[15px] font-semibold text-text">Próximo ajuste: {monthLabel(c.adjustment.nextDate!.slice(0, 7)).toLowerCase()}</p>
        <div className="mt-0.5 text-[13px]">
          <AdjustmentText c={c} />
        </div>
      </div>
    </section>
  );
}

function Services({ c, today, onUpload }: { c: PortalContract; today: string; onUpload: () => void }) {
  const period = today.slice(0, 7);
  const thisMonth = c.proofs.filter((p) => p.period === period);
  const rejected = c.proofs.filter((p) => p.status === "rechazado" && p.period >= DateTime.fromISO(`${period}-01`).minus({ months: 2 }).toFormat("yyyy-MM"));
  if (c.services.length === 0 && c.proofs.length === 0) return null;
  return (
    <section aria-labelledby="servicios" className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="servicios" className="font-display text-base font-semibold text-text">
          Servicios de {monthLabel(period).toLowerCase()}
        </h2>
        <button type="button" onClick={onUpload} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg">
          <IconUpload size={14} className="text-accent" /> Subir
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-text-faint">Subí la foto o el PDF de cada boleta que pagás vos.</p>
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {c.services.map((s) => {
          const p = thisMonth.find((x) => x.service === s && x.status !== "rechazado") ?? thisMonth.find((x) => x.service === s);
          const state = !p ? { label: "Falta subir", tone: "border border-border bg-surface text-text-faint" } : p.status === "aprobado" ? { label: "Aprobado", tone: "bg-sage-chip text-olive-light" } : p.status === "rechazado" ? { label: "Rechazado", tone: "bg-clay-chip text-terra" } : { label: "En revisión", tone: "bg-sand-chip text-warning" };
          return (
            <li key={s} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13.5px] font-semibold text-text">{s}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${state.tone}`}>{state.label}</span>
            </li>
          );
        })}
      </ul>
      {rejected.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {rejected.map((p) => (
            <li key={p.id} className="rounded-[14px] bg-clay-chip px-3.5 py-2.5 text-[12.5px] text-terra">
              <span className="font-semibold">{p.service} · {monthLabel(p.period)}:</span> {p.reviewNote ?? "rechazado"}. Volvé a subirlo.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Calendar({ c, today }: { c: PortalContract; today: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const list = showHistory ? c.history : [c.next, ...c.upcoming].filter((d): d is PortalDue => Boolean(d));
  return (
    <section aria-labelledby="vencimientos" className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="vencimientos" className="font-display text-base font-semibold text-text">
          {showHistory ? "Pagos anteriores" : "Próximos vencimientos"}
        </h2>
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-[12.5px] font-semibold text-terra hover:underline">
          {showHistory ? "Ver próximos" : "Ver anteriores"}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-text-faint">{showHistory ? "Todavía no hay pagos anteriores." : "No hay vencimientos próximos."}</p>
      ) : (
        <ol className="mt-3 flex flex-col">
          {list.map((d) => {
            const date = DateTime.fromISO(d.dueDate, { zone: "utc" }).setLocale("es");
            return (
              <li key={d.id} className="flex items-center gap-3 border-t border-border py-2.5 first:border-0 first:pt-0">
                <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] ${d.dueDate === today ? "bg-dark text-dark-fg" : "bg-bg text-text"}`}>
                  <span className="font-display text-[17px] font-bold leading-none tabular-nums">{date.day}</span>
                  <span className={`text-[10px] font-bold uppercase ${d.dueDate === today ? "text-dark-muted" : "text-text-faint"}`}>{date.toFormat("LLL")}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-text">{d.periodLabel}</p>
                  <p className="text-[12px] tabular-nums text-text-faint">{money(d.amount, c.currency)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[d.status].tone}`}>{STATUS[d.status].label}</span>
              </li>
            );
          })}
        </ol>
      )}
      {c.adjustment.nextDate && c.adjustment.alert === "none" && !showHistory && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2.5 text-[12px] text-text-faint">
          <IconFlag size={13} className="text-accent" /> Próximo ajuste: {dateAR(c.adjustment.nextDate)}
          {c.adjustment.index ? ` (${c.adjustment.index})` : ""}
        </p>
      )}
    </section>
  );
}

function Receipts({ c }: { c: PortalContract }) {
  return (
    <section aria-labelledby="recibos" className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <h2 id="recibos" className="font-display text-base font-semibold text-text">
        Mis recibos
      </h2>
      {c.receipts.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-text-faint">Cuando la inmobiliaria registre tu pago, el recibo aparece acá para descargar.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {c.receipts.map((r) => (
            <li key={r.id}>
              <a
                href={`/api/portal/recibos/${r.id}`}
                target="_blank"
                rel="noreferrer"
                className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-bg"
              >
                <IconReceipt size={18} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-text">{r.periodLabel ?? "Recibo"}</span>
                  <span className="block text-[11.5px] tabular-nums text-text-faint">
                    N° {r.number}
                    {r.issuedAt ? ` · ${dateAR(r.issuedAt)}` : ""}
                  </span>
                </span>
                <span className="font-display text-[13.5px] font-bold tabular-nums text-text">{r.amount ? money(r.amount, c.currency) : ""}</span>
                <IconDownload size={16} className="shrink-0 text-text-faint" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={`https://wa.me/${AGENCY_WHATSAPP}?text=${encodeURIComponent("Hola, te escribo desde el portal de inquilinos.")}`}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-text-muted hover:text-text ${className}`}
    >
      <IconWhatsApp size={16} /> Escribirle a la inmobiliaria
    </a>
  );
}

function UploadSheet({ c, open, onClose, today }: { c: PortalContract; open: boolean; onClose: () => void; today: string }) {
  const router = useRouter();
  const options = useMemo(() => [...c.services, "Otro"], [c.services]);
  const [service, setService] = useState(options[0]);
  const [other, setOther] = useState("");
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setService(options[0]);
    setOther("");
    setPeriod(today.slice(0, 7));
    setAmount("");
    setNotes("");
    setFile(null);
  }, [open, options, today]);

  async function submit() {
    const name = service === "Otro" ? other.trim() : service;
    if (!name) return toast.error("Elegí el servicio");
    if (!file) return toast.error("Adjuntá la foto o el PDF");
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("contractId", c.id);
      fd.append("service", name);
      fd.append("period", period);
      fd.append("amount", amount);
      fd.append("notes", notes);
      fd.append("file", file);
      const res = await fetch("/api/portal/comprobantes", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? "No se pudo subir");
      toast.success("¡Listo! La inmobiliaria lo va a revisar.");
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSending(false);
    }
  }

  const field = "h-12 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[15px] text-text outline-none focus:border-accent";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Subir comprobante"
      description={propertyLine(c.address, c.unit)}
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="text-[13px] font-semibold text-text-faint">
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={sending || !file} className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg disabled:opacity-50">
            <IconUpload size={16} className="text-accent" />
            {sending ? "Subiendo…" : "Enviar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-muted">Servicio</span>
          <SelectField value={service} onChange={(e) => setService(e.target.value)} className="h-12 text-[15px]">
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
        </label>
        {service === "Otro" && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="¿Qué servicio?" className={field} aria-label="Servicio" />}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text-muted">Mes</span>
            <input type="month" value={period} max={today.slice(0, 7)} onChange={(e) => setPeriod(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text-muted">Monto (opcional)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="$" className={field} />
          </label>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-border-strong bg-bg px-4 py-6 text-center hover:border-accent">
          <IconCamera size={26} className="text-accent" />
          <span className="text-[13.5px] font-semibold text-text">{file ? file.name : "Sacá una foto o elegí el archivo"}</span>
          <span className="text-[11.5px] text-text-faint">Foto o PDF, hasta 15 MB</span>
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-muted">Comentario (opcional)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[15px] text-text outline-none focus:border-accent" />
        </label>
      </div>
    </Sheet>
  );
}
