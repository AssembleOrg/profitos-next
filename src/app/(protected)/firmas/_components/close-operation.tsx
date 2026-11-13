"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatMoney, type AccountMovement } from "@/lib/account";
import { MovementFormModal } from "../../estados-cuenta/_components/movement-form-modal";
import type { SerializedAgent, SerializedCategory } from "../../estados-cuenta/_components/estados-cuenta-client";
import { now } from "@/lib/datetime";
import type { SerializedFirma } from "./types";
import { serializeFromApi } from "./serialize";

interface CloseData {
  pendingIncome: AccountMovement[];
  pendingExpense: AccountMovement[];
  incomeCategories: SerializedCategory[];
  expenseCategories: SerializedCategory[];
  agents: SerializedAgent[];
  people: { id: string; name: string }[];
  isCostearOwner: boolean;
}

async function loadCloseData(firmaId: string): Promise<CloseData> {
  const res = await fetch(`/api/firmas/${firmaId}/cierre`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message ?? "No se pudo preparar el cierre");
  return body.data as CloseData;
}

/**
 * Cierre de la operación (ya firmada): primero se registran como cobrados los
 * honorarios pendientes con el mismo formulario de Estados de cuenta (así van a
 * la ganancia de la inmobiliaria), y después la firma pasa a Entrega de llaves y
 * sale de la lista (queda en el filtro "Cerradas").
 */
export function CloseOperationPanel({
  firma,
  onUpdated,
}: Readonly<{ firma: SerializedFirma; onUpdated: (firma: SerializedFirma) => void }>) {
  const [data, setData] = useState<CloseData | null>(null);
  const [step, setStep] = useState<"idle" | "confirm" | "income" | "expense">("idle");
  const [busy, setBusy] = useState(false);
  const [collectedNow, setCollectedNow] = useState(false);

  async function patch(payload: Record<string, unknown>, success: string) {
    const res = await fetch(`/api/firmas/${firma.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message ?? "No se pudo guardar");
    toast.success(success);
    onUpdated(serializeFromApi(body.data));
  }

  async function start() {
    setBusy(true);
    try {
      const d = await loadCloseData(firma.id);
      setData(d);
      setStep(d.pendingIncome.length > 0 ? "income" : "confirm");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo preparar el cierre");
    } finally {
      setBusy(false);
    }
  }

  // Se cerró el formulario de cobro: si quedó cobrado sigue; si no, no se cierra.
  async function afterIncome() {
    const d = await loadCloseData(firma.id).catch(() => null);
    if (!d) return setStep("idle");
    setData(d);
    if (d.pendingIncome.length > 0) {
      toast.message("No se cerró: los honorarios siguen a cobrar.");
      return setStep("idle");
    }
    setCollectedNow(true);
    setStep(d.pendingExpense.length > 0 ? "expense" : "confirm");
  }

  async function afterExpense() {
    const d = await loadCloseData(firma.id).catch(() => null);
    if (d) setData(d);
    setStep("confirm");
  }

  async function close() {
    setBusy(true);
    try {
      await patch({ close: true }, "Operación cerrada: salió de la lista (filtro «Cerradas»)");
      setStep("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cerrar");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      await patch({ reopen: true }, "Operación reabierta");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reabrir");
    } finally {
      setBusy(false);
    }
  }

  if (firma.closedAt) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-sage-chip p-4">
        <div>
          <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-olive-light">Operación cerrada</h4>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Cerrada el {firma.closedAt.slice(0, 10).split("-").reverse().join("/")}. Sus honorarios ya están en Estados de cuenta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reopen()}
          disabled={busy}
          className="h-10 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:text-text disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Reabrir"}
        </button>
      </section>
    );
  }

  const pendingCollected = data?.pendingExpense ?? [];
  const today = now().toISODate()!;

  return (
    <section className="rounded-[16px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Cierre de la operación</h4>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Cuando ya se firmó: se registran los honorarios como cobrados (van a la ganancia de la inmobiliaria) y la propuesta sale de la lista.
          </p>
        </div>
        {step !== "confirm" && (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="h-10 shrink-0 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Preparando…" : "Cerrar operación"}
          </button>
        )}
      </div>

      {step === "confirm" && (
        <div className="mt-3 flex flex-col gap-3 rounded-[12px] bg-bg p-3">
          <p className="text-[12.5px] text-text">
            {collectedNow
              ? "Listo: los honorarios quedaron registrados como cobrados."
              : firma.operation.receivable === "collected"
                ? "Los honorarios ya están cobrados."
                : "No hay honorarios pendientes de cobrar en esta propuesta."}{" "}
            Pasa a «Entrega de llaves» y sale de la lista.
            {pendingCollected.length > 0 && (
              <>
                {" "}La parte del colega sigue «a pagar» en Estados de cuenta (
                {pendingCollected.map((e) => formatMoney(e.amount, e.currency)).join(" + ")}).
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("idle")}
              disabled={busy}
              className="h-10 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted hover:text-text disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void close()}
              disabled={busy}
              className="h-10 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Cerrando…" : "Confirmar cierre"}
            </button>
          </div>
        </div>
      )}

      {data && step === "income" && data.pendingIncome[0] && (
        <MovementFormModal
          open
          onOpenChange={(open) => {
            if (!open) void afterIncome();
          }}
          editing={data.pendingIncome[0]}
          collecting
          incomeCategories={data.incomeCategories}
          expenseCategories={data.expenseCategories}
          agents={data.agents}
          defaultDate={today}
          isCostearOwner={data.isCostearOwner}
          people={data.people}
        />
      )}
      {data && step === "expense" && data.pendingExpense[0] && (
        <MovementFormModal
          open
          onOpenChange={(open) => {
            if (!open) void afterExpense();
          }}
          editing={data.pendingExpense[0]}
          collecting
          incomeCategories={data.incomeCategories}
          expenseCategories={data.expenseCategories}
          agents={data.agents}
          defaultDate={today}
          isCostearOwner={data.isCostearOwner}
          people={data.people}
        />
      )}
    </section>
  );
}
