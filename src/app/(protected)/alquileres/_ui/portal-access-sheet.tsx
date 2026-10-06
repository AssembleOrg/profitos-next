"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { IconKey, IconWhatsApp } from "./icons";
import { Field, api, btnDanger, btnPrimary, btnSecondarySm, btnText, dateAR, inputBox } from "./kit";

export interface PortalAccessTarget {
  tenantId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  enabled: boolean;
  hasAccount: boolean;
  invitedAt: string | null;
  lastLoginAt: string | null;
}

function suggestPassword() {
  const words = ["casa", "patio", "llave", "puerta", "balcon", "ventana", "jardin", "terraza"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}

/**
 * Habilita el portal de un inquilino: el staff define la contraseña inicial y
 * se la pasa (no se mandan emails). Desde acá también se cambia o se corta.
 */
export function PortalAccessSheet({
  target,
  onClose,
  onChanged,
}: {
  target: PortalAccessTarget | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!target) return;
    setPassword(suggestPassword());
    setDone(null);
  }, [target]);

  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";

  async function enable() {
    if (!target) return;
    setSaving(true);
    try {
      await api(`/api/inquilinos/${target.tenantId}/portal`, { method: "POST", json: { password } });
      setDone({ email: target.email ?? "", password });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo habilitar el acceso");
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!target) return;
    setSaving(true);
    try {
      await api(`/api/inquilinos/${target.tenantId}/portal`, { method: "DELETE" });
      toast.success("Acceso desactivado");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo desactivar");
    } finally {
      setSaving(false);
    }
  }

  const message = done
    ? `Hola ${target?.fullName.split(" ")[0] ?? ""}, ya podés entrar al portal de inquilinos de Juliana Profitos Propiedades para ver tus vencimientos, bajar tus recibos y subir los comprobantes de servicios.\n\nEntrá en ${portalUrl}\nEmail: ${done.email}\nContraseña: ${done.password}`
    : "";
  const phone = target?.phone?.replace(/\D/g, "");

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title={target?.enabled ? "Acceso al portal" : "Dar acceso al portal"}
      description={target?.fullName}
      maxWidth="sm:max-w-md"
      footer={
        done ? (
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
            <button type="button" className={btnPrimary} disabled={saving || !target?.email || password.length < 8} onClick={enable}>
              <IconKey size={16} className="text-accent" />
              {saving ? "Guardando…" : target?.enabled ? "Cambiar contraseña" : "Habilitar acceso"}
            </button>
          </>
        )
      }
    >
      {target && !done && (
        <div className="flex flex-col gap-4">
          {!target.email ? (
            <p className="rounded-[14px] bg-sand-chip px-4 py-3 text-[13px] text-text">
              Para darle acceso, primero cargale un email en la ficha del inquilino. Va a ser su usuario.
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-text-muted">
                Va a entrar con <span className="font-semibold text-text">{target.email}</span> y la contraseña que definas acá. Después se la
                pasás vos (por WhatsApp, por ejemplo).
              </p>
              <Field label="Contraseña" hint="Mínimo 8 caracteres.">
                <div className="flex gap-2">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputBox} font-mono`} aria-label="Contraseña" />
                  <button type="button" className={btnSecondarySm + " h-11 shrink-0"} onClick={() => setPassword(suggestPassword())}>
                    Otra
                  </button>
                </div>
              </Field>
              {target.enabled && (
                <div className="flex items-center justify-between gap-3 rounded-[16px] bg-bg px-4 py-3">
                  <p className="text-[12.5px] text-text-muted">
                    Acceso activo desde {target.invitedAt ? dateAR(target.invitedAt) : "—"}
                    {target.lastLoginAt ? ` · último ingreso ${dateAR(target.lastLoginAt)}` : " · todavía no entró"}
                  </p>
                  <button type="button" className={btnDanger + " h-9 shrink-0"} disabled={saving} onClick={disable}>
                    Cortar acceso
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {done && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-muted">Listo. Pasale estos datos (la contraseña no se vuelve a mostrar):</p>
          <pre className="whitespace-pre-wrap rounded-[16px] bg-bg px-4 py-3 font-sans text-[13px] leading-relaxed text-text">{message}</pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondarySm}
              onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("Copiado"))}
            >
              Copiar mensaje
            </button>
            {phone && (
              <a
                className={btnSecondarySm}
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${phone.startsWith("54") ? phone : `54${phone}`}?text=${encodeURIComponent(message)}`}
              >
                <IconWhatsApp size={14} /> Enviar por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
