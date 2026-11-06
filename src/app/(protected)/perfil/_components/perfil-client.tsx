"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DeviceSessionDTO } from "@/lib/auth/device-sessions";
import { MAX_PHONES, whatsappLink, type ContactPhone } from "@/lib/auth/device-utils";
import { signOut } from "@/app/login/actions";
import type { MapPoint } from "./devices-map";

const DevicesMap = dynamic(() => import("./devices-map").then((m) => m.DevicesMap), {
  ssr: false,
  loading: () => <div className="h-[220px] animate-pulse rounded-2xl bg-surface-elevated md:h-[260px]" />,
});

interface Perfil {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  avatarCustom: boolean;
  phones: ContactPhone[];
}

interface Props {
  initial: Perfil;
  initialSessions: DeviceSessionDTO[];
}

const TZ = "America/Argentina/Buenos_Aires";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 10) return "activa ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

function placeLabel(s: DeviceSessionDTO) {
  const main = s.area || s.locality;
  if (!main) {
    if (s.latitude != null) return "Ubicación sin nombre";
    return s.locationSource === "denied" ? "Sin permiso de ubicación" : "Ubicación desconocida";
  }
  const sub = s.locality && s.locality !== main ? ` (${s.locality})` : "";
  return `${main}${sub}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
  if (!res.ok) throw new Error(body?.message || "No se pudo completar");
  return body?.data as T;
}

const inputCls =
  "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";
const cardCls = "rounded-[20px] border border-border bg-surface p-4 md:p-5";
const darkBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const ghostBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-60";

// ─── Foto ───────────────────────────────────────────────────────────

function FotoCard({ perfil, onChange }: Readonly<{ perfil: Perfil; onChange: (p: Partial<Perfil>) => void }>) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const initial = (perfil.fullName || perfil.email).trim().charAt(0).toUpperCase();

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<{ avatarUrl: string; avatarCustom: boolean }>("/api/perfil/foto", { method: "POST", body: fd });
      onChange(r);
      toast.success("Foto actualizada");
      router.refresh(); // barra superior
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await api<{ avatarUrl: string | null; avatarCustom: boolean }>("/api/perfil/foto", { method: "DELETE" });
      onChange(r);
      toast.success(r.avatarUrl ? "Volviste a la foto de Google" : "Foto quitada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Cambiar foto de perfil"
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-warning-chip md:h-24 md:w-24"
        >
          {perfil.avatarUrl ? (
            <img src={perfil.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="font-display text-[28px] font-bold text-text">{initial}</span>
          )}
          {busy && <span className="absolute inset-0 animate-pulse bg-scrim" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-text">{perfil.fullName || perfil.email.split("@")[0]}</p>
          <p className="truncate text-[12.5px] text-text-faint">{perfil.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => inputRef.current?.click()} disabled={busy}>
              {perfil.avatarUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {perfil.avatarCustom && (
              <button type="button" className={ghostBtn} onClick={remove} disabled={busy}>
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Es la foto que van a ver los clientes cuando les contestes una consulta. Mejor de frente y con buena luz.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
    </section>
  );
}

// ─── Teléfonos ──────────────────────────────────────────────────────

type PhoneRow = ContactPhone & { key: string };
const newKey = () => Math.random().toString(36).slice(2, 9);

function TelefonosCard({ initial, onSaved }: Readonly<{ initial: ContactPhone[]; onSaved: (p: ContactPhone[]) => void }>) {
  const [rows, setRows] = useState<PhoneRow[]>(() =>
    (initial.length ? initial : [{ label: "Celular", number: "", whatsapp: true }]).map((p) => ({ ...p, key: newKey() }))
  );
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);

  const clean = rows.filter((r) => r.number.trim() || r.label.trim()).map(({ label, number, whatsapp }) => ({ label, number, whatsapp }));
  const dirty = JSON.stringify(clean) !== saved;

  const update = (key: string, patch: Partial<ContactPhone>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ phones: ContactPhone[] }>("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: clean }),
      });
      setSaved(JSON.stringify(r.phones));
      onSaved(r.phones);
      toast.success("Teléfonos guardados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold text-text">Teléfonos de contacto</h2>
        <p className="mt-1 text-xs text-text-muted">
          Para que los clientes y el equipo te ubiquen. Podés cargar hasta {MAX_PHONES} y marcar cuáles tienen WhatsApp.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const wa = r.whatsapp && r.number.trim() ? whatsappLink(r.number) : null;
          return (
            <div key={r.key} className="rounded-2xl bg-bg p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={r.label}
                  onChange={(e) => update(r.key, { label: e.target.value })}
                  placeholder="Celular, oficina…"
                  maxLength={40}
                  aria-label="Etiqueta"
                  className={`${inputCls} sm:w-40 sm:shrink-0`}
                />
                <input
                  value={r.number}
                  onChange={(e) => update(r.key, { number: e.target.value })}
                  placeholder="11 2345 6789"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label="Número"
                  className={inputCls}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.whatsapp}
                  onClick={() => update(r.key, { whatsapp: !r.whatsapp })}
                  className="flex items-center gap-2 rounded-full py-1 pr-2 text-[12.5px] font-semibold text-text-muted"
                >
                  <span className={`relative block h-5 w-9 shrink-0 rounded-full transition-colors ${r.whatsapp ? "bg-success" : "bg-border-strong"}`}>
                    <span
                      className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${r.whatsapp ? "translate-x-[18px]" : "translate-x-0.5"}`}
                    />
                  </span>
                  Tiene WhatsApp
                </button>
                <div className="flex items-center gap-1">
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-success hover:underline">
                      Probar
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-danger hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {rows.length < MAX_PHONES ? (
          <button
            type="button"
            className={ghostBtn}
            onClick={() => setRows((rs) => [...rs, { label: "", number: "", whatsapp: false, key: newKey() }])}
          >
            + Agregar teléfono
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={darkBtn} onClick={save} disabled={!dirty || busy}>
          {busy ? "Guardando…" : "Guardar teléfonos"}
        </button>
      </div>
    </section>
  );
}

// ─── Dispositivos ───────────────────────────────────────────────────

function DeviceIcon({ device }: Readonly<{ device: string | null }>) {
  const phone = /^(iPhone|Android)/.test(device || "");
  return phone ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </svg>
  );
}

function SessionRow({ s, onRevoke, busy }: Readonly<{ s: DeviceSessionDTO; onRevoke?: (id: string) => void; busy?: boolean }>) {
  const mapsUrl = s.latitude != null && s.longitude != null ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : null;
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 shrink-0 ${s.active ? "text-text" : "text-text-faint"}`}>
        <DeviceIcon device={s.device} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13.5px] font-semibold text-text">{s.device || "Dispositivo"}</p>
          {s.current && <span className="rounded-full bg-warning-chip px-2 py-0.5 text-[10.5px] font-bold text-text">Este dispositivo</span>}
        </div>
        <p className="mt-0.5 text-[12.5px] text-text-muted">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {placeLabel(s)}
            </a>
          ) : (
            placeLabel(s)
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] text-text-faint">
          Entró el {formatDateTime(s.createdAt)}
          {s.active
            ? ` · ${s.current ? "activa ahora" : timeAgo(s.lastSeenAt)}`
            : s.revokedAt
              ? ` · cerrada el ${formatDateTime(s.revokedAt)}`
              : ""}
        </p>
      </div>
      {onRevoke && s.active && !s.current && (
        <button
          type="button"
          onClick={() => onRevoke(s.id)}
          disabled={busy}
          aria-label={`Cerrar sesión en ${s.device || "el dispositivo"}`}
          className="shrink-0 rounded-full border border-danger/40 px-3 py-1.5 text-[12px] font-semibold text-danger transition-colors hover:bg-danger-chip disabled:opacity-60"
        >
          Cerrar
        </button>
      )}
    </div>
  );
}

function DispositivosCard({ initial }: Readonly<{ initial: DeviceSessionDTO[] }>) {
  const [sessions, setSessions] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const active = useMemo(() => [...sessions.filter((s) => s.active)].sort((a, b) => Number(b.current) - Number(a.current)), [sessions]);
  const closed = sessions.filter((s) => !s.active);
  const others = active.filter((s) => !s.current).length;

  const points: MapPoint[] = useMemo(
    () =>
      (showHistory ? sessions : active)
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: `${s.device ?? "Dispositivo"} · ${placeLabel(s)}`, active: s.active, current: s.current })),
    [sessions, active, showHistory]
  );

  async function revoke(id: string) {
    setBusy(true);
    try {
      setSessions(await api<DeviceSessionDTO[]>(`/api/perfil/sesiones?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
      toast.success("Sesión cerrada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    setBusy(true);
    try {
      const r = await api<{ closed: number; sessions: DeviceSessionDTO[] }>("/api/perfil/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "others" }),
      });
      setSessions(r.sessions);
      setConfirmAll(false);
      toast.success("Listo: quedó abierta solo esta sesión");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold text-text">Dispositivos</h2>
        <p className="mt-1 text-xs text-text-muted">
          Dónde tenés la sesión abierta. Si no reconocés alguno, cerralo. La ubicación se toma una sola vez al entrar; no es
          seguimiento.
        </p>
      </header>

      {points.length > 0 && <DevicesMap points={points} />}

      <div className="mt-2 divide-y divide-border">
        {active.map((s) => (
          <SessionRow key={s.id} s={s} onRevoke={revoke} busy={busy} />
        ))}
      </div>

      {others > 0 && (
        <div className="mt-2">
          {confirmAll ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-danger-chip p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] text-text">
                Se cierra la sesión en {others === 1 ? "el otro dispositivo" : `los otros ${others} dispositivos`}. Este queda abierto.
              </p>
              <div className="flex gap-2">
                <button type="button" className={ghostBtn} onClick={() => setConfirmAll(false)} disabled={busy}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={revokeOthers}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-full bg-danger px-4 text-[13px] font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Cerrando…" : "Cerrar todas"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={ghostBtn} onClick={() => setConfirmAll(true)}>
              Cerrar las demás sesiones
            </button>
          )}
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted hover:text-text"
            aria-expanded={showHistory}
          >
            Historial ({closed.length})
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showHistory ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showHistory && (
            <div className="divide-y divide-border">
              {closed.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      )}

      <form action={signOut} className="mt-4 border-t border-border pt-4">
        <button type="submit" className={`${ghostBtn} w-full sm:w-auto`}>
          Cerrar sesión en este dispositivo
        </button>
      </form>
    </section>
  );
}

// ─── Página ─────────────────────────────────────────────────────────

export function PerfilClient({ initial, initialSessions }: Readonly<Props>) {
  const [perfil, setPerfil] = useState(initial);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-2">
      <section>
        <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Mi perfil</h1>
        <p className="mt-1 text-[12.5px] text-text-faint">Tu foto, cómo contactarte y dónde tenés la sesión abierta.</p>
      </section>

      <FotoCard perfil={perfil} onChange={(p) => setPerfil((x) => ({ ...x, ...p }))} />
      <TelefonosCard initial={perfil.phones} onSaved={(phones) => setPerfil((x) => ({ ...x, phones }))} />
      <DispositivosCard initial={initialSessions} />
    </div>
  );
}
