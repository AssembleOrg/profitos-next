"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  RENTAL_FREQUENCIES,
  RENTAL_FREQUENCY_LABEL,
  type RentalFrequency,
  formatARS,
  generateDueDates,
} from "@/lib/rentals";
import { formatDate } from "@/lib/datetime";
import { CurrencyInput } from "./currency-input";
import { DateField } from "../../_components/date-field";
import type {
  RentalAdditionalCatalogItem,
  RentalProperty,
  RentalTenant,
  SerializedContract,
} from "./types";

interface ContractWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: RentalProperty[];
  tenants: RentalTenant[];
  additionals: RentalAdditionalCatalogItem[];
  onCreated: (contract: SerializedContract) => void;
  onTenantCreated?: (tenant: RentalTenant) => void;
}

interface SelectedAdditional {
  additionalId: string;
  name: string;
  amount: number;
}

const STEPS = [
  { key: "scope", label: "Propiedad e inquilino" },
  { key: "contract", label: "Contrato" },
  { key: "additionals", label: "Adicionales" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function ContractWizard({
  open,
  onOpenChange,
  properties,
  tenants,
  additionals,
  onCreated,
  onTenantCreated,
}: Readonly<ContractWizardProps>) {
  const [step, setStep] = useState<StepKey>("scope");

  // Step 1
  const [propertyId, setPropertyId] = useState("");
  const [propertyQuery, setPropertyQuery] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantList, setTenantList] = useState<RentalTenant[]>(tenants);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [newTenant, setNewTenant] = useState({
    fullName: "",
    idType: "dni" as "dni" | "cuit",
    idNumber: "",
    phone: "",
    email: "",
  });

  // Step 2
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<RentalFrequency>("mensual");
  const [baseAmount, setBaseAmount] = useState<number | null>(null);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [notes, setNotes] = useState("");

  // Step 3
  const [selectedAdditionals, setSelectedAdditionals] = useState<SelectedAdditional[]>([]);
  const [additionalQuery, setAdditionalQuery] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("scope");
    setPropertyId("");
    setPropertyQuery("");
    setTenantId("");
    setTenantQuery("");
    setCreatingTenant(false);
    setNewTenant({ fullName: "", idType: "dni", idNumber: "", phone: "", email: "" });
    setTitle("");
    setStartDate("");
    setEndDate("");
    setFrequency("mensual");
    setBaseAmount(null);
    setFirstDueDate("");
    setGracePeriodDays(0);
    setNotes("");
    setSelectedAdditionals([]);
    setAdditionalQuery("");
    setTenantList(tenants);
  }, [open, tenants]);

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedTenant = tenantList.find((t) => t.id === tenantId);

  const filteredProperties = useMemo(() => {
    const q = propertyQuery.trim().toLowerCase();
    return q
      ? properties
          .filter((p) =>
            [p.address, p.city, p.zone].some((v) => v?.toLowerCase().includes(q)),
          )
          .slice(0, 60)
      : properties.slice(0, 60);
  }, [properties, propertyQuery]);

  const filteredTenants = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    return q
      ? tenantList
          .filter((t) =>
            [t.fullName, t.idNumber, t.phone, t.email].some((v) => v?.toLowerCase().includes(q)),
          )
          .slice(0, 30)
      : tenantList.slice(0, 30);
  }, [tenantList, tenantQuery]);

  const filteredAdditionals = useMemo(() => {
    const q = additionalQuery.trim().toLowerCase();
    return additionals
      .filter((a) => !selectedAdditionals.find((s) => s.additionalId === a.id))
      .filter((a) => (q ? a.name.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [additionals, selectedAdditionals, additionalQuery]);

  const previewDueDates = useMemo(() => {
    if (!startDate || !endDate || !firstDueDate || baseAmount === null) return [];
    return generateDueDates({
      startDate,
      endDate,
      firstDueDate,
      frequency,
      baseAmount,
    });
  }, [startDate, endDate, firstDueDate, baseAmount, frequency]);

  const additionalsTotal = useMemo(
    () => selectedAdditionals.reduce((acc, a) => acc + a.amount, 0),
    [selectedAdditionals],
  );

  const expectedPerCuota = (baseAmount ?? 0) + additionalsTotal;

  function canAdvance(): boolean {
    if (step === "scope") return Boolean(propertyId && tenantId);
    if (step === "contract") {
      return Boolean(
        startDate &&
          endDate &&
          firstDueDate &&
          baseAmount !== null &&
          baseAmount >= 0 &&
          new Date(startDate).getTime() <= new Date(endDate).getTime() &&
          new Date(firstDueDate).getTime() >= new Date(startDate).getTime() &&
          new Date(firstDueDate).getTime() <= new Date(endDate).getTime(),
      );
    }
    return true;
  }

  function next() {
    if (!canAdvance()) {
      toast.error("Completá los campos obligatorios");
      return;
    }
    if (step === "scope") setStep("contract");
    else if (step === "contract") setStep("additionals");
  }

  function back() {
    if (step === "contract") setStep("scope");
    else if (step === "additionals") setStep("contract");
  }

  async function createTenantInline() {
    if (!newTenant.fullName.trim() || !newTenant.idNumber.trim()) {
      toast.error("Falta nombre o documento");
      return;
    }
    try {
      const res = await fetch("/api/inquilinos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newTenant.fullName.trim(),
          idType: newTenant.idType,
          idNumber: newTenant.idNumber.trim(),
          phone: newTenant.phone.trim() || null,
          email: newTenant.email.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const created: RentalTenant = {
        id: body.data.id,
        fullName: body.data.fullName,
        idType: body.data.idType,
        idNumber: body.data.idNumber,
        phone: body.data.phone,
        email: body.data.email,
      };
      setTenantList((prev) => [created, ...prev]);
      setTenantId(created.id);
      setCreatingTenant(false);
      onTenantCreated?.(created);
      toast.success("Inquilino creado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear inquilino");
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const payload = {
        propertyId,
        tenantId,
        title: title.trim() || null,
        startDate,
        endDate,
        firstDueDate,
        frequency,
        baseAmount: baseAmount ?? 0,
        gracePeriodDays,
        notes: notes.trim() || null,
        additionals: selectedAdditionals.map((a) => ({
          additionalId: a.additionalId,
          amount: a.amount,
        })),
      };
      const res = await fetch("/api/alquileres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onCreated(body.data as SerializedContract);
      toast.success(`Contrato creado · ${previewDueDates.length} cuotas generadas`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[94dvh] w-[min(720px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border-olive/40 px-5 py-4">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-text">Nuevo contrato</Dialog.Title>
                    <Dialog.Description className="mt-0.5 text-xs text-text-muted">
                      Paso {stepIndex + 1} de {STEPS.length} · {STEPS[stepIndex].label}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </header>

                {/* Progress bar */}
                <div className="border-b border-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    {STEPS.map((s, idx) => (
                      <div key={s.key} className="flex flex-1 items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                            idx < stepIndex
                              ? "bg-olive-mid text-bg"
                              : idx === stepIndex
                                ? "bg-olive-bright text-bg"
                                : "border border-border bg-surface text-text-faint"
                          }`}
                        >
                          {idx < stepIndex ? "✓" : idx + 1}
                        </span>
                        {idx < STEPS.length - 1 && (
                          <span
                            className={`h-px flex-1 transition-colors ${idx < stepIndex ? "bg-olive-mid" : "bg-border"}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <AnimatePresence mode="wait">
                    {step === "scope" && (
                      <motion.div
                        key="scope"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col gap-5"
                      >
                        {/* Property */}
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-muted">
                            <span>Propiedad</span>
                            {selectedProperty && (
                              <button
                                type="button"
                                onClick={() => setPropertyId("")}
                                className="text-[10px] font-medium normal-case tracking-normal text-text-faint hover:text-text"
                              >
                                Cambiar
                              </button>
                            )}
                          </label>
                          {selectedProperty ? (
                            <div className="rounded-xl border border-olive-bright/30 bg-olive-subtle px-3 py-2">
                              <p className="text-sm font-medium text-text">{selectedProperty.address}</p>
                              <p className="text-[11px] text-text-muted">
                                {[selectedProperty.zone, selectedProperty.city].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={propertyQuery}
                                onChange={(e) => setPropertyQuery(e.target.value)}
                                placeholder="Buscar dirección, zona o ciudad…"
                                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                              />
                              <div className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-bg/40 p-1.5">
                                {filteredProperties.length === 0 ? (
                                  <p className="px-3 py-3 text-center text-xs text-text-muted">Sin coincidencias</p>
                                ) : (
                                  filteredProperties.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setPropertyId(p.id)}
                                      className="flex w-full flex-col items-start rounded-lg border border-transparent px-2.5 py-1.5 text-left transition-colors hover:border-olive-bright/40 hover:bg-bg"
                                    >
                                      <span className="line-clamp-1 text-sm text-text">{p.address}</span>
                                      <span className="line-clamp-1 text-[11px] text-text-faint">
                                        {[p.zone, p.city].filter(Boolean).join(" · ") || "—"}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Tenant */}
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-muted">
                            <span>Inquilino</span>
                            {selectedTenant && (
                              <button
                                type="button"
                                onClick={() => setTenantId("")}
                                className="text-[10px] font-medium normal-case tracking-normal text-text-faint hover:text-text"
                              >
                                Cambiar
                              </button>
                            )}
                          </label>
                          {selectedTenant ? (
                            <div className="rounded-xl border border-olive-bright/30 bg-olive-subtle px-3 py-2">
                              <p className="text-sm font-medium text-text">{selectedTenant.fullName}</p>
                              <p className="text-[11px] text-text-muted">
                                {selectedTenant.idType.toUpperCase()}: {selectedTenant.idNumber}
                                {selectedTenant.phone ? ` · ${selectedTenant.phone}` : ""}
                              </p>
                            </div>
                          ) : creatingTenant ? (
                            <div className="flex flex-col gap-2 rounded-xl border border-olive-bright/30 bg-olive-subtle/60 p-3">
                              <input
                                type="text"
                                placeholder="Nombre completo"
                                value={newTenant.fullName}
                                onChange={(e) => setNewTenant((p) => ({ ...p, fullName: e.target.value }))}
                                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <select
                                  value={newTenant.idType}
                                  onChange={(e) => setNewTenant((p) => ({ ...p, idType: e.target.value as "dni" | "cuit" }))}
                                  className="h-10 rounded-lg border border-border bg-bg px-2 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
                                >
                                  <option value="dni">DNI</option>
                                  <option value="cuit">CUIT</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Número"
                                  value={newTenant.idNumber}
                                  onChange={(e) => setNewTenant((p) => ({ ...p, idNumber: e.target.value }))}
                                  className="col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                                />
                              </div>
                              <input
                                type="tel"
                                placeholder="Teléfono"
                                value={newTenant.phone}
                                onChange={(e) => setNewTenant((p) => ({ ...p, phone: e.target.value }))}
                                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                              />
                              <input
                                type="email"
                                placeholder="Email (opcional)"
                                value={newTenant.email}
                                onChange={(e) => setNewTenant((p) => ({ ...p, email: e.target.value }))}
                                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={createTenantInline}
                                  className="rounded-xl border border-olive-bright/30 bg-olive-mid px-3 py-1.5 text-xs font-semibold text-bg hover:bg-olive-vivid"
                                >
                                  Crear inquilino
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCreatingTenant(false)}
                                  className="rounded-xl border border-border bg-bg px-3 py-1.5 text-xs text-text-muted hover:text-text"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={tenantQuery}
                                onChange={(e) => setTenantQuery(e.target.value)}
                                placeholder="Buscar por nombre, DNI/CUIT o teléfono…"
                                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                              />
                              <div className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-bg/40 p-1.5">
                                <button
                                  type="button"
                                  onClick={() => setCreatingTenant(true)}
                                  className="flex items-center gap-2 rounded-lg border border-dashed border-olive-bright/40 bg-olive-subtle/40 px-2.5 py-1.5 text-left text-sm text-accent hover:bg-olive-subtle"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  Nuevo inquilino
                                </button>
                                {filteredTenants.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTenantId(t.id)}
                                    className="flex w-full flex-col items-start rounded-lg border border-transparent px-2.5 py-1.5 text-left transition-colors hover:border-olive-bright/40 hover:bg-bg"
                                  >
                                    <span className="line-clamp-1 text-sm text-text">{t.fullName}</span>
                                    <span className="line-clamp-1 text-[11px] text-text-faint">
                                      {t.idType.toUpperCase()}: {t.idNumber}
                                      {t.phone ? ` · ${t.phone}` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {step === "contract" && (
                      <motion.div
                        key="contract"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col gap-4"
                      >
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Título <span className="text-text-faint">(opcional · ej. &ldquo;Hab. 3B&rdquo; o &ldquo;PB&rdquo;)</span>
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Identificador interno del contrato"
                            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Fecha inicio
                            </label>
                            <DateField value={startDate} onChange={setStartDate} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Fecha fin
                            </label>
                            <DateField value={endDate} onChange={setEndDate} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Frecuencia
                            </label>
                            <select
                              value={frequency}
                              onChange={(e) => setFrequency(e.target.value as RentalFrequency)}
                              className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
                            >
                              {RENTAL_FREQUENCIES.map((f) => (
                                <option key={f} value={f}>
                                  {RENTAL_FREQUENCY_LABEL[f]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Monto base
                            </label>
                            <CurrencyInput value={baseAmount} onChange={setBaseAmount} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Primer vencimiento
                            </label>
                            <DateField value={firstDueDate} onChange={setFirstDueDate} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Días de gracia
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={gracePeriodDays}
                              onChange={(e) => setGracePeriodDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none"
                            />
                            <p className="mt-1 text-[10px] text-text-faint">
                              Cantidad de días después del vencimiento antes de marcarlo como vencido.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Notas <span className="text-text-faint">(opcional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                          />
                        </div>
                      </motion.div>
                    )}

                    {step === "additionals" && (
                      <motion.div
                        key="additionals"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col gap-4"
                      >
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Adicionales <span className="text-text-faint">(opcional)</span>
                          </label>
                          {selectedAdditionals.length > 0 && (
                            <div className="mb-3 flex flex-col gap-2">
                              {selectedAdditionals.map((sa) => (
                                <div
                                  key={sa.additionalId}
                                  className="flex items-center gap-2 rounded-xl border border-olive-bright/30 bg-olive-subtle/60 px-3 py-2"
                                >
                                  <span className="flex-1 text-sm text-text">{sa.name}</span>
                                  <div className="w-full sm:w-44">
                                    <CurrencyInput
                                      value={sa.amount}
                                      onChange={(v) =>
                                        setSelectedAdditionals((prev) =>
                                          prev.map((p) =>
                                            p.additionalId === sa.additionalId
                                              ? { ...p, amount: v ?? 0 }
                                              : p,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedAdditionals((prev) =>
                                        prev.filter((p) => p.additionalId !== sa.additionalId),
                                      )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-500/40 hover:text-red-300"
                                    aria-label="Quitar"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="rounded-xl border border-border bg-bg/40 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <input
                                type="text"
                                value={additionalQuery}
                                onChange={(e) => setAdditionalQuery(e.target.value)}
                                placeholder="Buscar adicional…"
                                className="h-9 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
                              />
                            </div>
                            {filteredAdditionals.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-text-muted">
                                {additionals.length === 0
                                  ? "Todavía no hay adicionales en el catálogo. Agregalos en /adicionales (admin)."
                                  : "Sin más adicionales para sumar."}
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {filteredAdditionals.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedAdditionals((prev) => [
                                        ...prev,
                                        {
                                          additionalId: a.id,
                                          name: a.name,
                                          amount: a.defaultAmount ?? 0,
                                        },
                                      ])
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-olive-bright/40 hover:bg-olive-subtle hover:text-text"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    {a.name}
                                    {a.defaultAmount !== null && (
                                      <span className="text-text-faint">· {formatARS(a.defaultAmount)}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="rounded-xl border border-border bg-bg/30 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                              Preview de cuotas
                            </h4>
                            <span className="font-mono text-xs text-text">
                              {previewDueDates.length} cuota{previewDueDates.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="mb-3 text-xs text-text-muted">
                            Total esperado por cuota:{" "}
                            <span className="font-mono text-text">{formatARS(expectedPerCuota)}</span>{" "}
                            <span className="text-text-faint">
                              (base {formatARS(baseAmount ?? 0)}
                              {additionalsTotal > 0 ? ` + adicionales ${formatARS(additionalsTotal)}` : ""})
                            </span>
                          </p>
                          {previewDueDates.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border bg-bg/40 px-3 py-3 text-center text-xs text-text-muted">
                              Configurá fechas, frecuencia y monto en el paso anterior.
                            </p>
                          ) : (
                            <ul className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                              {previewDueDates.slice(0, 60).map((d) => (
                                <li
                                  key={d.position}
                                  className="flex items-center justify-between rounded-md bg-surface/40 px-2 py-1 text-[11px]"
                                >
                                  <span className="text-text-muted">#{d.position}</span>
                                  <span className="font-mono text-text">{formatDate(d.dueDate)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {previewDueDates.length > 60 && (
                            <p className="mt-2 text-[10px] text-text-faint">
                              … y {previewDueDates.length - 60} cuotas más se generarán al confirmar.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === "scope"}
                    className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Atrás
                  </button>
                  {step !== "additionals" ? (
                    <button
                      type="button"
                      onClick={next}
                      disabled={!canAdvance()}
                      className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Siguiente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={submitting || previewDueDates.length === 0}
                      className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Creando…" : `Crear contrato y generar ${previewDueDates.length} cuotas`}
                    </button>
                  )}
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
