"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/app/(protected)/_components/sheet";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select-field";
import { CurrencyInput } from "@/app/(protected)/alquileres/_components/currency-input";
import { formatMoney, type Currency } from "@/lib/account";
import type { FundBalance, PersonOption } from "@/lib/account/cash-server";

const inputClass =
  "w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:border-border-strong focus:outline-none";

interface Props {
  /** transfer = retiro / mover plata; adjust = fijar el saldo real. null = cerrado. */
  mode: "transfer" | "adjust" | null;
  onClose: () => void;
  funds: FundBalance[];
  people: PersonOption[];
  currentUserId: string;
  today: string;
}

function FundOptions({ people }: Readonly<{ people: PersonOption[] }>) {
  return (
    <>
      <option value="caja">Caja de la oficina</option>
      <option value="banco">Banco</option>
      <optgroup label="Persona">
        {people.map((p) => (
          <option key={p.id} value={`persona:${p.id}`}>{p.name}</option>
        ))}
      </optgroup>
    </>
  );
}

export function TransferSheet({ mode, onClose, funds, people, currentUserId, today }: Readonly<Props>) {
  const router = useRouter();
  const [from, setFrom] = useState("caja");
  const [to, setTo] = useState(`persona:${currentUserId}`);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setFrom("caja");
    setTo(mode === "adjust" ? "caja" : `persona:${currentUserId}`);
    setAmount(null);
    setCurrency("ARS");
    setDate(today);
    setDescription("");
  }, [mode, currentUserId, today]);

  const current = funds.find((f) => f.key === to)?.balance[currency] ?? 0;

  async function save() {
    if (amount == null || (mode === "transfer" && amount <= 0) || amount < 0) {
      toast.error(mode === "adjust" ? "Ingresá el saldo real" : "Ingresá un monto mayor a cero");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/estados-cuenta/caja/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode, from: mode === "transfer" ? from : null, to, amount, currency, date, description }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success(body?.message ?? "Listo");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={mode === "adjust" ? "Ajustar saldo" : "Retiro / mover plata"}
      maxWidth="sm:max-w-[520px]"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 text-[13px] font-semibold text-text-faint hover:text-text">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Guardando…" : mode === "adjust" ? "Ajustar" : "Registrar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-[14px] bg-bg px-3.5 py-2.5 text-[12.5px] text-text-muted">
          {mode === "adjust"
            ? "Contá la plata y poné el saldo real. Se registra la diferencia como ajuste."
            : "Por ejemplo: Juli se lleva plata de la caja, o se deposita la caja en el banco. No es ingreso ni gasto: solo cambia de lugar."}
        </p>

        {mode === "transfer" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Sale de</label>
              <SelectField value={from} onChange={(e) => setFrom(e.target.value)}>
                <FundOptions people={people} />
              </SelectField>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Va a</label>
              <SelectField value={to} onChange={(e) => setTo(e.target.value)}>
                <FundOptions people={people} />
              </SelectField>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Bolsillo</label>
            <SelectField value={to} onChange={(e) => setTo(e.target.value)}>
              <FundOptions people={people} />
            </SelectField>
            <p className="mt-1.5 text-[12px] text-text-faint">Saldo según el sistema: {formatMoney(current, currency)}</p>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
              {mode === "adjust" ? "Saldo real" : "Monto"}
            </label>
            <CurrencyInput value={amount} onChange={setAmount} placeholder="0" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Moneda</label>
            <div className="flex h-[42px] items-center gap-0.5 rounded-full border border-border bg-bg p-1">
              {(["ARS", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    currency === c ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Fecha</label>
          <DatePicker value={date} onChange={setDate} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
            Nota <span className="text-text-faint">(opcional)</span>
          </label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
      </div>
    </Sheet>
  );
}
