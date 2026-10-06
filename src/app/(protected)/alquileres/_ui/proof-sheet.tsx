"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { SelectField } from "@/components/ui/select-field";
import { CurrencyInput } from "../_components/currency-input";
import { MediaUploader } from "../_components/media-uploader";
import type { RentalAttachment } from "../_components/voice-recorder";
import { useSignedUrls } from "../_components/use-signed-urls";
import { IconUpload } from "./icons";
import { Field, api, btnPrimary, btnText, inputBox, textareaBox } from "./kit";

/** El staff carga un comprobante de servicio en nombre del inquilino. */
export function ProofSheet({
  contractId,
  services,
  defaultPeriod,
  open,
  onClose,
  onDone,
}: {
  contractId: string;
  services: string[];
  defaultPeriod: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [service, setService] = useState(services[0] ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [amount, setAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const urls = useSignedUrls(attachments.map((a) => a.path));

  useEffect(() => {
    if (!open) return;
    setService(services[0] ?? "");
    setPeriod(defaultPeriod);
    setAmount(null);
    setNotes("");
    setAttachments([]);
  }, [open, services, defaultPeriod]);

  async function submit() {
    setSaving(true);
    try {
      await api(`/api/alquileres/${contractId}/comprobantes`, {
        method: "POST",
        json: { service, period, amount, notes, attachments },
      });
      toast.success("Comprobante cargado");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cargar comprobante de servicio"
      description="Queda aprobado y el inquilino lo ve en su portal."
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={saving || !service || !period} onClick={submit}>
            <IconUpload size={16} className="text-accent" />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Servicio">
            {services.length > 0 ? (
              <SelectField value={service} onChange={(e) => setService(e.target.value)}>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
            ) : (
              <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Luz, gas…" className={inputBox} />
            )}
          </Field>
          <Field label="Mes">
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputBox} />
          </Field>
        </div>
        <Field label="Monto pagado (opcional)">
          <CurrencyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Archivo">
          <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={urls} compact />
        </Field>
        <Field label="Nota (opcional)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaBox} />
        </Field>
      </div>
    </Sheet>
  );
}
