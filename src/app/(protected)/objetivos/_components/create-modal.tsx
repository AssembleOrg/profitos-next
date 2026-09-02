"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { Spinner } from "../../_components/spinner";
import { defaultPeriod } from "@/lib/objectives";
import { now } from "@/lib/datetime";
import { DateField } from "../../_components/date-field";
import type { SerializedCard, SerializedUser } from "./types";

interface CreateObjetivoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: SerializedUser[];
  /** When set, the modal opens in edit mode for this card. */
  editing: SerializedCard | null;
  onCreated: (cards: SerializedCard[]) => void;
  onUpdated: (card: SerializedCard) => void;
}

interface DraftItem {
  id: string;
  text: string;
}

function makeDraftItem(text = ""): DraftItem {
  return { id: Math.random().toString(36).slice(2), text };
}

export function CreateObjetivoModal({
  open,
  onOpenChange,
  users,
  editing,
  onCreated,
  onUpdated,
}: Readonly<CreateObjetivoModalProps>) {
  const isEdit = editing !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [items, setItems] = useState<DraftItem[]>([makeDraftItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isEdit && editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setStartDate(editing.startDate.slice(0, 10));
      setEndDate(editing.endDate.slice(0, 10));
      setSelectedUserIds([editing.assignedToUser.id]);
      setItems(
        editing.items.length > 0
          ? editing.items.map((i) => ({ id: i.id, text: i.text }))
          : [makeDraftItem()],
      );
    } else {
      const period = defaultPeriod();
      setTitle("");
      setDescription("");
      setStartDate(period.startDate);
      setEndDate(period.endDate);
      setSelectedUserIds([]);
      setItems([makeDraftItem()]);
    }
    setUserQuery("");
  }, [open, isEdit, editing]);

  const filteredUsers = users.filter((u) => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.fullName?.toLowerCase().includes(q) ?? false)
    );
  });

  function toggleUser(id: string) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function setQuickPeriod(kind: "this-month" | "next-month") {
    const today = now();
    const base = kind === "this-month" ? today : today.plus({ months: 1 });
    setStartDate(base.startOf("month").toISODate() ?? "");
    setEndDate(base.endOf("month").toISODate() ?? "");
  }

  async function handleSubmit() {
    const cleanItems = items.map((i) => i.text.trim()).filter((t) => t.length > 0);

    if (!title.trim()) {
      toast.error("Falta el título");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Faltan las fechas");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("La fecha de inicio no puede ser posterior a la de fin");
      return;
    }
    if (!isEdit && selectedUserIds.length === 0) {
      toast.error("Seleccioná al menos un empleado");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        const res = await fetch(`/api/objetivos/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            startDate,
            endDate,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? "Error");
        onUpdated(serializeCard(body.data));
        toast.success("Objetivo actualizado");
      } else {
        const res = await fetch(`/api/objetivos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignedToUserIds: selectedUserIds,
            title: title.trim(),
            description: description.trim() || null,
            startDate,
            endDate,
            items: cleanItems.map((text) => ({ text })),
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? "Error");
        const created = (body.data as unknown[]).map(serializeCard);
        onCreated(created);
        toast.success(
          created.length === 1 ? "Objetivo creado" : `${created.length} objetivos creados`,
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel = isEdit
    ? submitting
      ? "Guardando…"
      : "Guardar cambios"
    : submitting
      ? "Creando…"
      : selectedUserIds.length <= 1
        ? "Crear objetivo"
        : `Crear ${selectedUserIds.length} objetivos`;

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Editar objetivo" : "Nuevo objetivo"}
      description={
        isEdit
          ? "Actualizá título, descripción o período."
          : "Creá una card con ítems y asignala a uno o varios empleados."
      }
      maxWidth="sm:max-w-[640px]"
      footer={
        <div className="flex w-full items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex h-11 items-center justify-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Spinner /> : ctaLabel}
          </button>
        </div>
      }
    >
                <div>
                  <div className="flex flex-col gap-5">
                    {!isEdit && (
                      <div>
                        <label htmlFor="users" className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                          <span>Empleados</span>
                          <span className="normal-case tracking-normal font-semibold text-text-faint">
                            {selectedUserIds.length} seleccionado{selectedUserIds.length === 1 ? "" : "s"}
                          </span>
                        </label>
                        <input
                          id="users"
                          type="text"
                          placeholder="Buscar por nombre o email…"
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                        />
                        <div className="mt-2 flex max-h-44 flex-wrap content-start gap-1.5 overflow-y-auto rounded-[14px] border border-border bg-bg p-2">
                          {filteredUsers.length === 0 ? (
                            <p className="w-full px-3 py-3 text-center text-xs text-text-faint">
                              Sin coincidencias
                            </p>
                          ) : (
                            filteredUsers.map((u) => {
                              const checked = selectedUserIds.includes(u.id);
                              const display = u.fullName?.trim() || u.email.split("@")[0];
                              return (
                                <label
                                  key={u.id}
                                  title={u.email}
                                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                    checked
                                      ? "bg-dark text-dark-fg"
                                      : "border border-border bg-surface text-text-muted hover:bg-bg"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleUser(u.id)}
                                    className="sr-only"
                                  />
                                  {checked && (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                  <span className="truncate">{display}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="title" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                        Título
                      </label>
                      <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Atender bien a los clientes"
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                        Descripción <span className="normal-case tracking-normal">(opcional)</span>
                      </label>
                      <textarea
                        id="description"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Contexto u objetivo general…"
                        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                        <span>Período</span>
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQuickPeriod("this-month")}
                            className="rounded-full bg-sand-chip px-2.5 py-1 text-[10.5px] font-semibold normal-case tracking-normal text-text-muted transition-opacity hover:opacity-80"
                          >
                            Este mes
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickPeriod("next-month")}
                            className="rounded-full bg-sand-chip px-2.5 py-1 text-[10.5px] font-semibold normal-case tracking-normal text-text-muted transition-opacity hover:opacity-80"
                          >
                            Mes siguiente
                          </button>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DateField value={startDate} onChange={setStartDate} />
                        <DateField value={endDate} onChange={setEndDate} />
                      </div>
                    </div>

                    {!isEdit && (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                          Ítems del objetivo
                        </label>
                        <div className="flex flex-col gap-1.5">
                          {items.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg font-display text-[11px] font-bold text-text-muted">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id ? { ...i, text: e.target.value } : i,
                                    ),
                                  )
                                }
                                placeholder="Ej. Llamar a 5 clientes nuevos"
                                className="h-10 flex-1 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                                disabled={items.length === 1}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80 disabled:opacity-40"
                                aria-label="Quitar ítem"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setItems((prev) => [...prev, makeDraftItem()])}
                            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-bg"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Agregar ítem
                          </button>
                        </div>
                      </div>
                    )}

                    {isEdit && (
                      <p className="rounded-[14px] bg-bg px-3.5 py-2.5 text-[11px] text-text-faint">
                        Los ítems se editan directamente en la card (agregar / borrar / marcar).
                      </p>
                    )}
                  </div>
                </div>
    </Sheet>
  );
}

function serializeCard(raw: unknown): SerializedCard {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    startDate:
      typeof r.startDate === "string"
        ? r.startDate.slice(0, 10)
        : new Date(r.startDate as string).toISOString().slice(0, 10),
    endDate:
      typeof r.endDate === "string"
        ? r.endDate.slice(0, 10)
        : new Date(r.endDate as string).toISOString().slice(0, 10),
    statusOverride: (r.statusOverride as SerializedCard["statusOverride"]) ?? null,
    assignedToUser: r.assignedToUser as SerializedCard["assignedToUser"],
    createdByUser: r.createdByUser as SerializedCard["createdByUser"],
    items: ((r.items as unknown[]) ?? []).map((item) => {
      const i = item as Record<string, unknown>;
      return {
        id: i.id as string,
        text: i.text as string,
        status: i.status as SerializedCard["items"][number]["status"],
        position: i.position as number,
        evaluatedAt: i.evaluatedAt
          ? new Date(i.evaluatedAt as string).toISOString()
          : null,
        evaluatedByUser: i.evaluatedByUser as SerializedCard["items"][number]["evaluatedByUser"],
      };
    }),
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}
