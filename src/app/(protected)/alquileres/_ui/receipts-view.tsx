"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatReceiptNo } from "@/lib/rentals/money";
import type { ReceiptBookDTO, ReceiptListItem } from "@/lib/rentals/dto";
import { Sheet } from "../../_components/sheet";
import { useReasonSheet } from "./reason-sheet";
import { IconBan, IconChevronLeft, IconChevronRight, IconPencil, IconReceipt, IconSearch } from "./icons";
import { Empty, Field, Pill, api, btnPrimary, btnSecondarySm, btnText, dateAR, inputBox, money, monthLabel, propertyLine, shiftMonth, textareaBox } from "./kit";
import { changeMark } from "@/lib/motion";

const KIND_LABEL = { inquilino: "Inquilino", propietario: "Propietario" } as const;

export function ReceiptsView({
  books,
  receipts,
  month,
  kind,
  status,
  q,
}: {
  books: ReceiptBookDTO[];
  receipts: ReceiptListItem[];
  month: string;
  kind: string;
  status: string;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const [editBook, setEditBook] = useState<ReceiptBookDTO | null>(null);
  const [voidBook, setVoidBook] = useState<ReceiptBookDTO | null>(null);
  const [dialog, ask] = useReasonSheet();

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  async function voidOne(r: ReceiptListItem) {
    const label = formatReceiptNo(r.pointOfSale, r.number);
    const reason = await ask({
      title: `Anular recibo ${label}`,
      description: "El número queda anulado en el talonario. El cobro sigue registrado.",
      confirmLabel: "Anular recibo",
      reason: "required",
      placeholder: "Motivo",
      danger: true,
    });
    if (reason === null) return;
    try {
      await api(`/api/alquileres/recibos/${r.id}/anular`, { method: "POST", json: { reason } });
      toast.success(`Recibo ${label} anulado`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  const issued = receipts.filter((r) => r.status === "emitido");
  const totals = {
    inquilino: issued.filter((r) => r.bookKind === "inquilino").reduce((a, r) => a + (r.amount ?? 0), 0),
    propietario: issued.filter((r) => r.bookKind === "propietario").reduce((a, r) => a + (r.amount ?? 0), 0),
  };

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      {/* Talonarios */}
      <div className="grid gap-3 md:grid-cols-2">
        {books.map((b) => (
          <section
            key={b.kind}
            aria-label={b.label}
            className={`flex flex-col gap-3 rounded-[20px] p-4 md:p-5 ${b.kind === "inquilino" ? "bg-dark text-dark-fg" : "border border-border bg-surface"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[16px] font-semibold">{b.kind === "inquilino" ? "Talonario del inquilino" : "Talonario del propietario"}</h2>
                <p className={`text-[12px] ${b.kind === "inquilino" ? "text-dark-muted" : "text-text-faint"}`}>
                  {b.kind === "inquilino" ? "Recibo por cuenta de terceros" : "Recibo con honorarios descontados"}
                </p>
              </div>
              {!b.configured && <Pill tone="bg-accent text-dark">Confirmar número</Pill>}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={`text-[12px] ${b.kind === "inquilino" ? "text-dark-muted" : "text-text-faint"}`}>Próximo número</p>
                <p className="font-display text-[26px] font-bold tabular-nums leading-tight">{formatReceiptNo(b.pointOfSale, b.nextNumber)}</p>
              </div>
              <p className={`text-right text-[12px] ${b.kind === "inquilino" ? "text-dark-muted" : "text-text-faint"}`}>
                {monthLabel(month)}
                <br />
                <span className={`font-display text-[14px] font-bold tabular-nums ${b.kind === "inquilino" ? "text-dark-fg" : "text-text"}`}>{money(totals[b.kind])}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditBook(b)}
                className={b.kind === "inquilino" ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[12.5px] font-semibold text-dark-fg hover:bg-white/15" : btnSecondarySm}
              >
                <IconPencil size={14} /> Cambiar numeración
              </button>
              <button
                type="button"
                onClick={() => setVoidBook(b)}
                className={b.kind === "inquilino" ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[12.5px] font-semibold text-dark-fg hover:bg-white/15" : btnSecondarySm}
              >
                <IconBan size={14} /> Anular un número
              </button>
            </div>
          </section>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Mes anterior" onClick={() => navigate({ mes: shiftMonth(month, -1) })} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-bg">
            <IconChevronLeft size={16} />
          </button>
          <span className="min-w-[128px] text-center font-display text-[16px] font-semibold text-text">{monthLabel(month)}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => navigate({ mes: shiftMonth(month, 1) })} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-bg">
            <IconChevronRight size={16} />
          </button>
          <div role="radiogroup" aria-label="Talonario" className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1">
            {[
              { v: "", l: "Todos" },
              { v: "inquilino", l: "Inquilino" },
              { v: "propietario", l: "Propietario" },
              { v: "anulado", l: "Anulados" },
            ].map((o) => {
              const active = o.v === "anulado" ? status === "anulado" : status !== "anulado" && kind === o.v;
              return (
                <button
                  key={o.l}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => navigate(o.v === "anulado" ? { estado: "anulado", tipo: null } : { tipo: o.v || null, estado: null })}
                  className={`rounded-full px-3 py-1 text-[12px] ${active ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"}`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim() || null });
          }}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-2 focus-within:border-accent lg:w-72"
        >
          <IconSearch size={16} className="shrink-0 text-text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, dirección o nombre"
            aria-label="Buscar recibos"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
          {pending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Cargando" />}
        </form>
      </div>

      {receipts.length === 0 ? (
        <Empty title="No hay recibos en este mes" icon={<IconReceipt size={20} />}>
          Los recibos se emiten al cobrar desde la{" "}
          <Link href="/alquileres" className="font-semibold text-terra hover:underline">
            agenda
          </Link>
          .
        </Empty>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface md:block">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Número", "Talonario", "Propiedad", "A nombre de", "Período", "Monto", ""].map((h, i) => (
                    <th key={i} scope="col" className={`px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint ${h === "Monto" ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} ref={changeMark(`${r.id}|${r.status}|${r.number}`)} className={`border-t border-border transition-colors hover:bg-bg ${r.status === "anulado" ? "text-text-faint" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className={`font-display text-[13.5px] font-bold tabular-nums ${r.status === "anulado" ? "line-through" : "text-text"}`}>{formatReceiptNo(r.pointOfSale, r.number)}</p>
                      <p className="text-[11.5px] tabular-nums text-text-faint">{r.issuedAt ? dateAR(r.issuedAt) : r.voidedAt ? `anulado ${dateAR(r.voidedAt)}` : "—"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Pill tone={r.bookKind === "inquilino" ? "bg-sand-chip text-text" : "bg-sage-chip text-olive-light"}>{KIND_LABEL[r.bookKind]}</Pill>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      {r.contractId ? (
                        <Link href={`/alquileres/${r.contractId}`} className="block truncate text-[13px] font-semibold text-text hover:underline">
                          {r.propertyAddress ? propertyLine(r.propertyAddress, r.unit) : "—"}
                        </Link>
                      ) : (
                        <span className="text-[12.5px] text-text-faint">Número sin usar</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[13px] text-text-muted">{r.bookKind === "inquilino" ? r.tenantName : r.ownerName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-text-muted">{r.period ?? (r.voidReason ? <span className="italic">{r.voidReason}</span> : "—")}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-display text-[13.5px] font-bold tabular-nums">{r.amount ? money(r.amount) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {r.status === "emitido" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <a href={`/api/alquileres/recibos/${r.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-full bg-dark px-3 py-1 text-[11.5px] font-bold text-dark-fg hover:opacity-90">
                            PDF
                          </a>
                          <button type="button" onClick={() => voidOne(r)} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-text-faint hover:bg-clay-chip hover:text-terra">
                            Anular
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11.5px]" title={r.voidReason ?? undefined}>
                          Anulado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {receipts.map((r) => (
              <li key={r.id} ref={changeMark(`${r.id}|${r.status}|${r.number}`)} className="rounded-[18px] border border-border bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-display text-[14px] font-bold tabular-nums ${r.status === "anulado" ? "text-text-faint line-through" : "text-text"}`}>{formatReceiptNo(r.pointOfSale, r.number)}</p>
                    <p className="truncate text-[12px] text-text-faint">
                      {r.propertyAddress ? propertyLine(r.propertyAddress, r.unit) : r.voidReason ?? "Número sin usar"}
                    </p>
                  </div>
                  <Pill tone={r.bookKind === "inquilino" ? "bg-sand-chip text-text" : "bg-sage-chip text-olive-light"}>{KIND_LABEL[r.bookKind]}</Pill>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-[12px] text-text-muted">
                    {r.bookKind === "inquilino" ? r.tenantName : r.ownerName}
                    {r.period ? ` · ${r.period}` : ""}
                  </p>
                  {r.status === "emitido" ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-display text-[14px] font-bold tabular-nums text-text">{r.amount ? money(r.amount) : ""}</span>
                      <a href={`/api/alquileres/recibos/${r.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-full bg-dark px-3 py-1 text-[11.5px] font-bold text-dark-fg">
                        PDF
                      </a>
                    </div>
                  ) : (
                    <span className="text-[11.5px] text-text-faint">Anulado</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <BookSheet book={editBook} onClose={() => setEditBook(null)} onDone={() => router.refresh()} />
      <VoidNumberSheet book={voidBook} onClose={() => setVoidBook(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function BookSheet({ book, onClose, onDone }: { book: ReceiptBookDTO | null; onClose: () => void; onDone: () => void }) {
  const [next, setNext] = useState("");
  const [pos, setPos] = useState("");
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState<ReceiptBookDTO | null>(null);
  if (book !== synced) {
    setSynced(book);
    if (book) {
      setNext(String(book.nextNumber));
      setPos(String(book.pointOfSale));
    }
  }
  async function submit() {
    if (!book) return;
    setSaving(true);
    try {
      await api("/api/alquileres/talonarios", { method: "PATCH", json: { kind: book.kind, nextNumber: Number(next), pointOfSale: Number(pos) } });
      toast.success("Numeración actualizada");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      open={Boolean(book)}
      onClose={onClose}
      title={book?.kind === "inquilino" ? "Numeración del talonario del inquilino" : "Numeración del talonario del propietario"}
      description="Usá el número de la próxima hoja libre de tu talonario de papel."
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={saving || !Number(next) || !Number(pos)} onClick={submit}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Punto de venta">
          <input value={pos} onChange={(e) => setPos(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className={`${inputBox} tabular-nums`} />
        </Field>
        <Field label="Próximo número">
          <input value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" className={`${inputBox} tabular-nums`} />
        </Field>
      </div>
      <p className="mt-3 rounded-[14px] bg-bg px-3.5 py-2.5 font-display text-[18px] font-bold tabular-nums text-text">
        {formatReceiptNo(Number(pos) || 1, Number(next) || 1)}
      </p>
      <p className="mt-2 text-[12px] text-text-faint">Si ese número ya se usó, el sistema te avisa al cobrar y podés corregirlo ahí mismo.</p>
    </Sheet>
  );
}

function VoidNumberSheet({ book, onClose, onDone }: { book: ReceiptBookDTO | null; onClose: () => void; onDone: () => void }) {
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState<ReceiptBookDTO | null>(null);
  if (book !== synced) {
    setSynced(book);
    if (book) {
      setNumber(String(book.nextNumber));
      setReason("");
    }
  }
  async function submit() {
    if (!book) return;
    setSaving(true);
    try {
      await api("/api/alquileres/talonarios/anular-numero", { method: "POST", json: { kind: book.kind, number: Number(number), reason } });
      toast.success(`Número ${formatReceiptNo(book.pointOfSale, Number(number))} anulado`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      open={Boolean(book)}
      onClose={onClose}
      title="Anular un número del talonario"
      description="Para hojas rotas, mal escritas o salteadas. Queda registrado y no se vuelve a usar."
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={saving || !Number(number) || !reason.trim()} onClick={submit}>
            {saving ? "Anulando…" : "Anular número"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Número" hint={book ? `Talonario ${book.kind === "inquilino" ? "del inquilino" : "del propietario"} · ${formatReceiptNo(book.pointOfSale, Number(number) || 0)}` : undefined}>
          <input value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" className={`${inputBox} tabular-nums`} />
        </Field>
        <Field label="Motivo">
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: hoja rota" className={textareaBox} />
        </Field>
      </div>
    </Sheet>
  );
}
