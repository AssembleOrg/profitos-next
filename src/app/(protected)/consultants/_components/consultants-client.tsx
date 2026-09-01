"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { firstPhone } from "@/lib/whatsapp";
import type { InboxMessage, InboxPortal } from "@/lib/messages/inbox";

const PORTAL_META: Record<InboxPortal, { label: string; dot: string }> = {
  mercadolibre: { label: "MercadoLibre", dot: "#f2c94c" },
  zonaprop: { label: "ZonaProp", dot: "#7b61ff" },
  argenprop: { label: "ArgenProp", dot: "#e2574c" },
};

const KIND_LABEL: Record<string, string> = {
  mensajes: "Mensaje",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  contactados: "Contacto",
  pregunta: "Pregunta",
};

// Pestañas de estado de gestión (jp_contact_cases).
const ESTADOS: { key: string; label: string }[] = [
  { key: "nuevos", label: "Nuevos" },
  { key: "espera", label: "En espera" },
  { key: "tomados", label: "Tomados" },
  { key: "descartados", label: "Descartados" },
];

interface Props {
  items: InboxMessage[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  counts: Record<InboxPortal, number>;
  filters: { q: string; portal: string; from: string; to: string; estado: string; mine: boolean };
  viewer: { userId: string; isAdmin: boolean };
  users: { id: string; fullName: string | null; email: string }[];
}

function formatDateTime24(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function PortalChip({ portal, kind }: { portal: InboxPortal; kind: string }) {
  const meta = PORTAL_META[portal];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden />
      {meta.label}
      <span className="text-text-faint">· {KIND_LABEL[kind] ?? kind}</span>
    </span>
  );
}

function ContactChips({ item }: { item: InboxMessage }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {item.email && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(item.email!);
            toast.success("Mail copiado");
          }}
          className="inline-flex max-w-[210px] items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted transition-colors hover:bg-border/50 active:opacity-60"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
          <span className="truncate">{item.email}</span>
        </button>
      )}
      {item.phone && (
        <WhatsAppLink
          phone={item.phone}
          className="inline-flex max-w-fit items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-semibold text-olive-light transition-opacity hover:opacity-80 active:opacity-60"
        >
          {firstPhone(item.phone)}
        </WhatsAppLink>
      )}
      {!item.email && !item.phone && <span className="text-[11.5px] text-text-faint">Sin datos de contacto</span>}
    </div>
  );
}

/** Tarjeta de contacto (boceto: foto de la propiedad, título, mensaje, ✓ / ✗). */
function ContactCard({
  item,
  viewer,
  users,
  busy,
  onAction,
}: {
  item: InboxMessage;
  viewer: Props["viewer"];
  users: Props["users"];
  busy: string | null;
  onAction: (messageId: string, action: "take" | "wait" | "transfer" | "restore", toUserId?: string) => void;
}) {
  const title = item.propertyAddress ?? item.propertyTitle ?? item.propertyRef ?? "Sin propiedad";
  const propHref = item.propertyId
    ? `/propiedades?${item.propertyAddress ? `q=${encodeURIComponent(item.propertyAddress)}&` : ""}open=${item.propertyId}`
    : null;
  const isBusy = busy === item.id;
  const canTransfer = item.caseStatus === "tomado" && (item.takenByUserId === viewer.userId || viewer.isAdmin);

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface">
      {/* Foto de la propiedad */}
      <div className="relative aspect-[16/9] bg-bg">
        {item.coverImageUrl ? (
          <Image src={item.coverImageUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-text-faint">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
            </svg>
          </div>
        )}
        <div className="absolute left-2 top-2"><PortalChip portal={item.portal} kind={item.kind} /></div>
        <span className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
          {formatDateTime24(item.date)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {/* Título: la propiedad */}
        {propHref ? (
          <Link href={propHref} className="line-clamp-1 text-[14px] font-bold text-text hover:underline">
            {title}
          </Link>
        ) : (
          <p className="line-clamp-1 text-[14px] font-bold text-text">{title}</p>
        )}

        {/* Contacto + mensaje */}
        <p className="mt-1 text-[13px] font-semibold text-text-muted">{item.name?.trim() || (item.portal === "mercadolibre" ? "Pregunta pública" : "Sin nombre")}</p>
        {item.message && <p className="mt-1 line-clamp-3 text-[12.5px] text-text-muted">“{item.message}”</p>}
        <ContactChips item={item} />

        {/* Estado / acciones */}
        <div className="mt-3 flex flex-1 items-end">
          {item.caseStatus === "tomado" ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="rounded-full bg-sage-chip px-2.5 py-1 text-[11.5px] font-bold text-olive-light">
                Atiende: {item.takenByName ?? "—"}
              </span>
              {canTransfer && (
                <select
                  defaultValue=""
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.value) onAction(item.id, "transfer", e.target.value);
                    e.target.value = "";
                  }}
                  className="ml-auto max-w-[150px] rounded-full border border-border bg-surface px-2 py-1 text-[11.5px] font-semibold text-text-muted disabled:opacity-50"
                  aria-label="Transferir a"
                >
                  <option value="">Transferir a…</option>
                  {users
                    .filter((u) => u.id !== item.takenByUserId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName?.trim() || u.email}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ) : item.caseStatus === "espera" ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="rounded-full bg-sand-chip px-2.5 py-1 text-[11.5px] font-bold text-warning">En espera</span>
              <button
                onClick={() => onAction(item.id, "restore")}
                disabled={isBusy}
                title="Deshacer: vuelve a Nuevos (por si fue un error)"
                className="ml-auto rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-bold text-text-muted transition-colors hover:bg-bg disabled:opacity-50"
              >
                ↩ Restaurar
              </button>
              <button
                onClick={() => onAction(item.id, "take")}
                disabled={isBusy}
                className="rounded-full bg-dark px-3.5 py-1.5 text-[12px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? "…" : "✓ Tomar igual"}
              </button>
            </div>
          ) : item.caseStatus === "descartado" ? (
            <div className="flex w-full items-center gap-2">
              <span className="rounded-full bg-bg px-2.5 py-1 text-[11.5px] font-bold text-text-faint">Descartado</span>
              <button
                onClick={() => onAction(item.id, "restore")}
                disabled={isBusy}
                title="Vuelve a Nuevos"
                className="ml-auto rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-bold text-text-muted transition-colors hover:bg-bg disabled:opacity-50"
              >
                ↩ Restaurar
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center gap-2">
              <button
                onClick={() => onAction(item.id, "take")}
                disabled={isBusy}
                title="Lo tomo yo: crea/reusa el cliente y arma un seguimiento asignado a mí"
                className="flex-1 rounded-full bg-dark px-3.5 py-2 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? "Tomando…" : "✓ Tomar"}
              </button>
              <button
                onClick={() => onAction(item.id, "wait")}
                disabled={isBusy}
                title="Pasa a espera: si en 3 días nadie lo toma, se descarta solo"
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-[12.5px] font-bold text-text-muted transition-colors hover:bg-bg disabled:opacity-50"
              >
                ✗ Espera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Carta del modo repaso (estilo Tinder): arrastrá a la derecha para tomar,
 * a la izquierda para dejar en espera — o usá los botones.
 */
function DeckCard({
  item,
  isBusy,
  onDecide,
}: {
  item: InboxMessage;
  isBusy: boolean;
  onDecide: (action: "take" | "wait") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-12, 12]);
  const takeOpacity = useTransform(x, [40, 140], [0, 1]);
  const waitOpacity = useTransform(x, [-140, -40], [1, 0]);
  const title = item.propertyAddress ?? item.propertyTitle ?? item.propertyRef ?? "Sin propiedad";

  return (
    <motion.div
      drag={isBusy ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      style={{ x, rotate }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onDecide("take");
        else if (info.offset.x < -120) onDecide("wait");
      }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: 0, opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className="relative flex max-h-[80vh] w-full cursor-grab flex-col overflow-hidden rounded-[22px] border border-border bg-surface shadow-2xl active:cursor-grabbing"
    >
      {/* Sellos de decisión al arrastrar */}
      <motion.span style={{ opacity: takeOpacity }} className="pointer-events-none absolute left-4 top-4 z-10 rounded-[10px] border-4 border-olive-light px-3 py-1 text-[20px] font-black uppercase text-olive-light">
        Tomar ✓
      </motion.span>
      <motion.span style={{ opacity: waitOpacity }} className="pointer-events-none absolute right-4 top-4 z-10 rounded-[10px] border-4 border-warning px-3 py-1 text-[20px] font-black uppercase text-warning">
        Espera ✗
      </motion.span>

      <div className="relative aspect-[16/10] flex-shrink-0 bg-bg">
        {item.coverImageUrl ? (
          <Image src={item.coverImageUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 560px" className="pointer-events-none select-none object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-text-faint">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
            </svg>
          </div>
        )}
        <div className="absolute left-3 top-3"><PortalChip portal={item.portal} kind={item.kind} /></div>
        <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
          {formatDateTime24(item.date)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <h3 className="text-[18px] font-bold leading-tight text-text">{title}</h3>
        <p className="mt-1 text-[14px] font-semibold text-text-muted">
          {item.name?.trim() || (item.portal === "mercadolibre" ? "Pregunta pública" : "Sin nombre")}
        </p>
        {item.message && <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">“{item.message}”</p>}
        <ContactChips item={item} />
      </div>

      <div className="flex flex-shrink-0 items-center justify-center gap-6 border-t border-border p-4">
        <button
          onClick={() => onDecide("wait")}
          disabled={isBusy}
          title="Dejar en espera (se descarta solo en 3 días)"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-warning bg-sand-chip text-[26px] font-black text-warning transition-transform hover:scale-105 disabled:opacity-50"
        >
          ✗
        </button>
        <button
          onClick={() => onDecide("take")}
          disabled={isBusy}
          title="Tomar: cliente + seguimiento asignados a vos"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-olive-light bg-sage-chip text-[26px] font-black text-olive-light transition-transform hover:scale-105 disabled:opacity-50"
        >
          {isBusy ? "…" : "✓"}
        </button>
      </div>
    </motion.div>
  );
}

export function ConsultantsClient({ items, page, totalPages, total, limit, totalAll, counts, filters, viewer, users }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [fromFilter, setFromFilter] = useState(filters.from);
  const [toFilter, setToFilter] = useState(filters.to);
  const [busy, setBusy] = useState<string | null>(null);
  // Modo repaso (Tinder): pila local de nuevos; null = cerrado.
  const [deck, setDeck] = useState<InboxMessage[] | null>(null);
  const [deckDone, setDeckDone] = useState(0);

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyFilters() {
    pushParams((params) => {
      const set = (k: string, v: string) => (v.trim() ? params.set(k, v.trim()) : params.delete(k));
      set("q", query);
      set("from", fromFilter);
      set("to", toFilter);
    });
  }

  function resetFilters() {
    setQuery("");
    setFromFilter("");
    setToFilter("");
    router.push(pathname);
  }

  function setPortal(portal: string) {
    pushParams((params) => (portal ? params.set("portal", portal) : params.delete("portal")));
  }

  async function doAction(
    messageId: string,
    action: "take" | "wait" | "transfer" | "restore",
    toUserId?: string,
    opts: { refresh?: boolean } = {}
  ): Promise<boolean> {
    setBusy(messageId);
    try {
      const res = await fetch("/api/consultants/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, action, toUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "No se pudo aplicar");
      toast.success(body?.message ?? "Listo");
      if (opts.refresh !== false) router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function closeDeck() {
    setDeck(null);
    setDeckDone(0);
    router.refresh(); // sincronizar la grilla con lo decidido en el repaso
  }

  async function deckDecide(action: "take" | "wait") {
    const current = deck?.[0];
    if (!current) return;
    const ok = await doAction(current.id, action, undefined, { refresh: false });
    // Avanza también si falló por "ya lo tomó otro" (la carta ya no es accionable).
    if (ok || action === "take") {
      setDeck((prev) => (prev ? prev.slice(1) : prev));
      setDeckDone((n) => n + 1);
    }
  }

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "Todos", count: totalAll },
    { key: "mercadolibre", label: "MercadoLibre", count: counts.mercadolibre },
    { key: "zonaprop", label: "ZonaProp", count: counts.zonaprop },
    { key: "argenprop", label: "ArgenProp", count: counts.argenprop },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Últimos contactos</h1>
          <p className="text-[12.5px] text-text-faint">
            Central de mensajes de MercadoLibre, ZonaProp y ArgenProp · Mostrando {items.length} de {total}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {/* Repaso uno-por-uno de los nuevos (popup estilo Tinder) */}
        {filters.estado === "nuevos" && items.length > 0 && (
          <button
            onClick={() => {
              setDeck(items);
              setDeckDone(0);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-dark px-4 py-2 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            Repasar nuevos ({total})
          </button>
        )}
        {/* Mis contactos / Todos — para no-admin arranca en "Mis" */}
        <div className="flex rounded-full border border-border bg-surface p-1">
          {[
            { mine: true, label: "Mis contactos" },
            { mine: false, label: "Todos" },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => pushParams((p) => p.set("mine", t.mine ? "1" : "0"))}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-colors ${
                filters.mine === t.mine ? "bg-dark text-dark-fg" : "text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Estado de gestión */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const active = filters.estado === e.key;
          return (
            <button
              key={e.key}
              onClick={() => pushParams((p) => p.set("estado", e.key))}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-dark text-dark-fg" : "border border-border bg-surface text-text-muted hover:bg-bg"
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      {/* Tabs por portal */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (filters.portal || "") === t.key;
          return (
            <button
              key={t.key || "all"}
              onClick={() => setPortal(t.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-dark text-dark-fg" : "border border-border bg-surface text-text-muted hover:bg-bg"
              }`}
            >
              {t.key && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PORTAL_META[t.key as InboxPortal].dot }}
                  aria-hidden
                />
              )}
              {t.label}
              <span className={active ? "text-dark-fg/70" : "text-text-faint"}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="rounded-[20px] border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono, mensaje..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <DatePicker
            value={fromFilter}
            onChange={setFromFilter}
            aria-label="Desde"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
          />
          <DatePicker
            value={toFilter}
            onChange={setToFilter}
            aria-label="Hasta"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={applyFilters}
            className="inline-flex h-10 items-center rounded-full bg-dark px-4.5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            Aplicar filtros
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Grilla de tarjetas */}
      {items.length === 0 ? (
        <p className="py-10 text-center text-[12.5px] text-text-faint">
          {filters.estado === "nuevos" ? "No hay contactos nuevos 🎉" : "Sin resultados para los filtros"}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ContactCard key={item.id} item={item} viewer={viewer} users={users} busy={busy} onAction={doAction} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {/* Popup de repaso estilo Tinder: una carta por vez, swipe o botones. */}
      {deck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeDeck}>
          <div className="flex w-full max-w-[560px] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex w-full items-center justify-between px-1">
              <span className="text-[13px] font-bold text-white/90">
                {deck.length ? `Contacto ${deckDone + 1} de ${deckDone + deck.length}` : "Repaso terminado"}
              </span>
              <button
                onClick={closeDeck}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                aria-label="Cerrar repaso"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {deck.length === 0 ? (
              <div className="flex w-full flex-col items-center gap-3 rounded-[22px] border border-border bg-surface p-10">
                <span className="text-[40px]">🎉</span>
                <p className="text-[15px] font-bold text-text">¡Repasaste todos los contactos!</p>
                <button onClick={closeDeck} className="rounded-full bg-dark px-5 py-2 text-[13px] font-bold text-dark-fg hover:opacity-90">
                  Volver a la lista
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <DeckCard
                  key={deck[0].id}
                  item={deck[0]}
                  isBusy={busy === deck[0].id}
                  onDecide={(a) => void deckDecide(a)}
                />
              </AnimatePresence>
            )}
            <p className="text-[11.5px] text-white/60">Arrastrá la carta: derecha = tomar · izquierda = espera</p>
          </div>
        </div>
      )}
    </div>
  );
}
