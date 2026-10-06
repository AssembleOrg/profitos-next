"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { PortalAccessSheet, type PortalAccessTarget } from "./portal-access-sheet";
import { useReasonSheet } from "./reason-sheet";
import { IconKey, IconPlus, IconSearch, IconUser, IconWhatsApp } from "./icons";
import { Empty, Field, Pill, Segmented, api, btnPrimary, btnSecondarySm, btnText, initials, inputBox, textareaBox } from "./kit";

export interface PersonRow {
  id: string;
  fullName: string;
  idType: string;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  contractsCount: number;
  activeContracts: Array<{ id: string; address: string; unit: string | null }>;
  portal?: { enabled: boolean; hasAccount: boolean; invitedAt: string | null; lastLoginAt: string | null };
}

type Kind = "inquilino" | "propietario";

const CONFIG: Record<Kind, { title: string; api: string; singular: string; empty: string }> = {
  inquilino: { title: "Inquilinos", api: "/api/inquilinos", singular: "inquilino", empty: "Los inquilinos se cargan acá o al crear un contrato." },
  propietario: { title: "Propietarios", api: "/api/propietarios", singular: "propietario", empty: "Los propietarios (locadores) firman el recibo con honorarios descontados." },
};

function wa(phone: string | null) {
  const d = phone?.replace(/\D/g, "");
  return d ? `https://wa.me/${d.startsWith("54") ? d : `54${d}`}` : null;
}

/** Fichas de inquilinos o propietarios, con el acceso al portal para inquilinos. */
export function PeopleView({ kind, rows, isAdmin }: { kind: Kind; rows: PersonRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const cfg = CONFIG[kind];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PersonRow | "new" | null>(null);
  const [portal, setPortal] = useState<PortalAccessTarget | null>(null);
  const [dialog, ask] = useReasonSheet();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.fullName} ${r.idNumber ?? ""} ${r.phone ?? ""} ${r.email ?? ""} ${r.activeContracts.map((c) => c.address).join(" ")}`.toLowerCase().includes(s));
  }, [rows, q]);

  async function remove(r: PersonRow) {
    const ok = await ask({
      title: `Eliminar a ${r.fullName}`,
      description: "Solo se puede si no tiene contratos.",
      confirmLabel: "Eliminar",
      reason: "none",
      danger: true,
    });
    if (ok === null) return;
    try {
      await api(`${cfg.api}/${r.id}`, { method: "DELETE" });
      toast.success("Eliminado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold leading-tight text-text md:text-[28px]">{cfg.title}</h1>
          <p className="mt-0.5 text-[12.5px] text-text-faint">
            {rows.length} {rows.length === 1 ? cfg.singular : `${cfg.singular}s`}
            {kind === "inquilino" ? ` · ${rows.filter((r) => r.portal?.enabled).length} con acceso al portal` : ""}
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
          <IconPlus size={16} className="text-accent" />
          <span className="hidden sm:inline">Nuevo {cfg.singular}</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-2 focus-within:border-accent sm:w-80">
          <IconSearch size={16} className="shrink-0 text-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, DNI, teléfono o dirección"
            aria-label={`Buscar ${cfg.title.toLowerCase()}`}
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
        </div>
        <Link href="/alquileres" className="text-[12.5px] font-semibold text-terra hover:underline">
          Ir a la agenda de alquileres
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Empty title={q ? "Nadie coincide con la búsqueda" : `Todavía no hay ${cfg.title.toLowerCase()}`} icon={<IconUser size={20} />}>
          {q ? "Probá con otro dato." : cfg.empty}
        </Empty>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface md:block">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Nombre", "Contacto", kind === "inquilino" ? "Alquila" : "Propiedades alquiladas", kind === "inquilino" ? "Portal" : "", ""].map((h, i) => (
                    <th key={i} scope="col" className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-bg">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold text-text-muted ${["bg-sand-chip", "bg-sage-chip", "bg-clay-chip"][i % 3]}`}>
                          {initials(r.fullName)}
                        </span>
                        <div className="min-w-0">
                          <button type="button" onClick={() => setEditing(r)} className="block max-w-[240px] truncate text-left text-[13.5px] font-bold text-text hover:underline">
                            {r.fullName}
                          </button>
                          <p className="text-[11.5px] tabular-nums text-text-faint">{r.idNumber ? `${r.idType.toUpperCase()} ${r.idNumber}` : "Sin documento"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-text-muted">
                      <p className="tabular-nums">{r.phone || "—"}</p>
                      <p className="max-w-[220px] truncate text-[11.5px] text-text-faint">{r.email || "Sin email"}</p>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      {r.activeContracts.length > 0 ? (
                        r.activeContracts.slice(0, 2).map((c) => (
                          <Link key={c.id} href={`/alquileres/${c.id}`} className="block truncate text-[13px] font-semibold text-text hover:underline">
                            {c.address}
                            {c.unit ? ` · ${c.unit}` : ""}
                          </Link>
                        ))
                      ) : (
                        <span className="text-[12.5px] text-text-faint">{r.contractsCount ? `${r.contractsCount} contratos terminados` : "Sin contratos"}</span>
                      )}
                      {r.activeContracts.length > 2 && <span className="text-[11.5px] text-text-faint">y {r.activeContracts.length - 2} más</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {kind === "inquilino" &&
                        (r.portal?.enabled ? <Pill tone="bg-sage-chip text-olive-light">Activo</Pill> : <span className="text-[12px] text-text-faint">Sin acceso</span>)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <RowActions kind={kind} r={r} isAdmin={isAdmin} onEdit={() => setEditing(r)} onPortal={() => setPortal(toPortal(r))} onRemove={() => remove(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-border bg-surface md:hidden">
            {filtered.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setEditing(r)} className="min-w-0 text-left">
                    <span className="block truncate text-[14px] font-bold text-text">{r.fullName}</span>
                    <span className="block truncate text-[12px] tabular-nums text-text-faint">
                      {r.idNumber ? `${r.idType.toUpperCase()} ${r.idNumber}` : "Sin documento"}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </span>
                  </button>
                  {kind === "inquilino" && r.portal?.enabled && <Pill tone="bg-sage-chip text-olive-light">Portal</Pill>}
                </div>
                {r.activeContracts.length > 0 && (
                  <p className="truncate text-[12.5px]">
                    {r.activeContracts.map((c, idx) => (
                      <span key={c.id}>
                        {idx > 0 && ", "}
                        <Link href={`/alquileres/${c.id}`} className="font-semibold text-text hover:underline">
                          {c.address}
                          {c.unit ? ` · ${c.unit}` : ""}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                <RowActions kind={kind} r={r} isAdmin={isAdmin} onEdit={() => setEditing(r)} onPortal={() => setPortal(toPortal(r))} onRemove={() => remove(r)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <PersonSheet kind={kind} target={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
      <PortalAccessSheet target={portal} onClose={() => setPortal(null)} onChanged={() => router.refresh()} />
    </div>
  );
}

function PersonSheet({ kind, target, onClose, onSaved }: { kind: Kind; target: PersonRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const cfg = CONFIG[kind];
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<"dni" | "cuit">("dni");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    const r = target === "new" ? null : target;
    setFullName(r?.fullName ?? "");
    setIdType(r?.idType === "cuit" ? "cuit" : "dni");
    setIdNumber(r?.idNumber ?? "");
    setPhone(r?.phone ?? "");
    setEmail(r?.email ?? "");
    setNotes(r?.notes ?? "");
  }, [target]);

  const isNew = target === "new";
  const needsId = kind === "inquilino";

  async function submit() {
    if (!fullName.trim()) return toast.error("Falta el nombre");
    if (needsId && !idNumber.trim()) return toast.error("Falta el DNI o CUIT");
    setSaving(true);
    try {
      const body = { fullName, idType, idNumber, phone, email, notes };
      if (isNew) await api(cfg.api, { method: "POST", json: body });
      else if (target) await api(`${cfg.api}/${target.id}`, { method: "PATCH", json: body });
      toast.success(isNew ? `${kind === "inquilino" ? "Inquilino" : "Propietario"} cargado` : "Cambios guardados");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title={isNew ? `Nuevo ${cfg.singular}` : `Editar ${cfg.singular}`}
      maxWidth="sm:max-w-md"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={saving} onClick={submit}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nombre y apellido">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputBox} autoFocus />
        </Field>
        <Field label="Documento">
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Segmented ariaLabel="Tipo de documento" size="sm" value={idType} onChange={setIdType} options={[{ value: "dni", label: "DNI" }, { value: "cuit", label: "CUIT" }]} />
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} inputMode="numeric" placeholder={needsId ? "Número" : "Número (opcional)"} className={inputBox} aria-label="Número de documento" />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputBox} />
          </Field>
          <Field label="Email" hint={kind === "inquilino" ? "Es su usuario del portal." : undefined}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputBox} />
          </Field>
        </div>
        <Field label="Notas">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaBox} />
        </Field>
      </div>
    </Sheet>
  );
}

function toPortal(r: PersonRow): PortalAccessTarget {
  return {
    tenantId: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    enabled: r.portal?.enabled ?? false,
    hasAccount: r.portal?.hasAccount ?? false,
    invitedAt: r.portal?.invitedAt ?? null,
    lastLoginAt: r.portal?.lastLoginAt ?? null,
  };
}

function RowActions({
  kind,
  r,
  isAdmin,
  onEdit,
  onPortal,
  onRemove,
}: {
  kind: Kind;
  r: PersonRow;
  isAdmin: boolean;
  onEdit: () => void;
  onPortal: () => void;
  onRemove: () => void;
}) {
  const link = wa(r.phone);
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      {kind === "inquilino" && (
        <button type="button" className={btnSecondarySm} onClick={onPortal}>
          <IconKey size={14} /> {r.portal?.enabled ? "Acceso" : "Dar acceso"}
        </button>
      )}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className={btnSecondarySm} aria-label={`WhatsApp a ${r.fullName}`}>
          <IconWhatsApp size={14} />
        </a>
      )}
      <button type="button" className={btnSecondarySm} onClick={onEdit}>
        Editar
      </button>
      {isAdmin && r.contractsCount === 0 && (
        <button type="button" className="px-1 text-[12px] font-semibold text-text-faint hover:text-terra" onClick={onRemove}>
          Eliminar
        </button>
      )}
    </div>
  );
}
