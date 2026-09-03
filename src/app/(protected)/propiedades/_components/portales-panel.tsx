"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet } from "../../_components/sheet";

type PortalKey = "mercadolibre" | "zonaprop" | "argenprop";

const PORTAL_META: Record<PortalKey, { label: string; dot: string; publishable: boolean }> = {
  mercadolibre: { label: "MercadoLibre", dot: "#f2c94c", publishable: false },
  zonaprop: { label: "ZonaProp", dot: "#7b61ff", publishable: true },
  argenprop: { label: "ArgenProp", dot: "#e2574c", publishable: true },
};
const ORDER: PortalKey[] = ["zonaprop", "argenprop", "mercadolibre"];

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "Activa", cls: "bg-sage-chip text-olive-light" },
  draft: { label: "Borrador", cls: "bg-sand-chip text-text-muted" },
  publishing: { label: "Publicando…", cls: "bg-sand-chip text-text-muted" },
  paused: { label: "Pausada", cls: "bg-sand-chip text-text-muted" },
  closed: { label: "Cerrada", cls: "bg-bg text-text-faint" },
  error: { label: "Error", cls: "bg-clay-chip text-terra" },
};

// Planes de publicación de ZonaProp (a más "exposición", más caro). El value es
// el publication_plan que espera STEP_PLAN_SELECTION.
const ZP_PLANS: { value: string; label: string }[] = [
  { value: "3", label: "Simple" },
  { value: "2", label: "Destacado" },
  { value: "1", label: "Súper Destacado" },
];
const ZP_PLAN_LABEL = (v: string) => ZP_PLANS.find((p) => p.value === v)?.label ?? "Simple";

type ConnStatus = { portal: PortalKey; connected: boolean; lastOkAt: string | null; needsAction: boolean; actionHint: string | null };
type Publication = { portal: string; status: string; published: boolean; permalink: string | null; lastError: string | null };
type PlanCredit = { plan: string; label: string; available: number | null; used: number | null; total: number | null };
type Credits = { plans: PlanCredit[]; fetchedAt: string | null; error: string | null };
type Responsible = { userId: number; name: string; lastName: string; email: string };
type MissingField = { campo: string; label: string };
type PortalReady = { portal: PortalKey; ok: boolean; faltan: MissingField[]; recomendado: MissingField[] };
type ReadinessMap = Record<PortalKey, PortalReady>;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? null) as T;
  } catch {
    return null;
  }
}

export function PortalesPanel({ propertyId }: { propertyId: string }) {
  const [conn, setConn] = useState<ConnStatus[]>([]);
  const [pubs, setPubs] = useState<Record<string, Publication>>({});
  const [selected, setSelected] = useState<Set<PortalKey>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [relogin, setRelogin] = useState<{ portal: PortalKey; viewUrl: string; sessionId: string } | null>(null);
  const [zpPlan, setZpPlan] = useState<string>("3"); // plan de exposición para ZonaProp activo
  const [credits, setCredits] = useState<Credits | null>(null);
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [readiness, setReadiness] = useState<ReadinessMap | null>(null);
  const [respUserId, setRespUserId] = useState<string>(""); // "" = responsable por defecto
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Confirmación reutilizable (reemplaza window.confirm) para publicar/cambiar estado.
  const [confirm, setConfirm] = useState<{ title: string; body: string; cta: string; danger?: boolean; run: () => void } | null>(null);

  const load = useCallback(async () => {
    const [statusData, pubData, creditsData, respData] = await Promise.all([
      getJson<{ portals: ConnStatus[] }>("/api/integrations/portales/status"),
      getJson<{ publications: Publication[]; readiness: ReadinessMap | null }>(`/api/integrations/portales/publications/${propertyId}`),
      getJson<Credits>("/api/integrations/portales/credits"),
      getJson<{ responsibles: Responsible[] }>("/api/integrations/portales/responsibles"),
    ]);
    if (respData?.responsibles) setResponsibles(respData.responsibles);
    if (statusData) setConn(statusData.portals);
    if (pubData) {
      const map: Record<string, Publication> = {};
      for (const p of pubData.publications) map[p.portal] = p;
      setPubs(map);
      setReadiness(pubData.readiness ?? null);
    }
    if (creditsData) setCredits(creditsData);
    setLoading(false);
  }, [propertyId]);

  async function refreshCredits() {
    setRefreshingCredits(true);
    try {
      const res = await fetch("/api/integrations/portales/credits", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (body?.data) setCredits(body.data);
      if (body?.data?.refreshed) toast.success("Cupo actualizado");
      else toast.message(body?.message ?? "No se pudo actualizar el cupo");
    } catch {
      toast.error("Error al actualizar el cupo");
    } finally {
      setRefreshingCredits(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  // Mientras haya algo "publicando", refrescar cada 8s (el worker es async).
  useEffect(() => {
    const anyPublishing = Object.values(pubs).some((p) => p.status === "publishing");
    if (anyPublishing && !pollRef.current) {
      pollRef.current = setInterval(() => void load(), 8000);
    } else if (!anyPublishing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pubs, load]);

  const connOf = (portal: PortalKey) => conn.find((c) => c.portal === portal);

  async function publishOne(portal: PortalKey, activate = false) {
    const plan = portal === "zonaprop" && activate ? zpPlan : undefined;
    const responsibleUserId = portal === "zonaprop" && respUserId ? respUserId : undefined;
    setBusy(portal);
    try {
      const res = await fetch(`/api/integrations/portales/${portal}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, activate, plan, responsibleUserId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "No se pudo encolar");
      }
      const okMsg = activate
        ? `${PORTAL_META[portal].label}: publicando activo (gasta crédito)`
        : portal === "argenprop"
          ? `${PORTAL_META[portal].label}: publicación encolada`
          : `${PORTAL_META[portal].label}: borrador encolado`;
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setBusy(null);
    }
  }

  async function publishSelected() {
    const portals = [...selected];
    if (!portals.length) return;
    setBusy("bulk");
    try {
      const res = await fetch("/api/integrations/portales/publish-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, portals }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "No se pudo encolar");
      }
      toast.success(`Encolado en ${portals.length} portal(es)`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setBusy(null);
    }
  }

  async function startRelogin(portal: PortalKey) {
    setBusy(`relogin:${portal}`);
    try {
      const res = await fetch("/api/integrations/portales/relogin/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portal }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "No se pudo iniciar");
      const { viewUrl, sessionId } = body.data ?? {};
      if (!viewUrl || !sessionId) throw new Error("Respuesta inválida del worker");
      setRelogin({ portal, viewUrl, sessionId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al iniciar el login remoto");
    } finally {
      setBusy(null);
    }
  }

  async function finishRelogin() {
    if (!relogin) return;
    setBusy("relogin:finish");
    try {
      const res = await fetch("/api/integrations/portales/relogin/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portal: relogin.portal, sessionId: relogin.sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.data?.ok) throw new Error(body?.data?.message ?? body?.message ?? "Todavía no estás logueado");
      toast.success(body.data.message ?? "Conexión restablecida");
      setRelogin(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo confirmar el login");
    } finally {
      setBusy(null);
    }
  }

  async function cancelRelogin() {
    const portal = relogin?.portal;
    setRelogin(null);
    if (portal) {
      void fetch("/api/integrations/portales/relogin/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portal }),
      });
    }
  }

  /**
   * Pausar / Dar de baja / Reactivar una publicación existente.
   * ML aplica al instante (API oficial); ArgenProp se encola al worker (segundos).
   * ZonaProp no está soportado (su panel no expone el circuito de forma estable).
   */
  async function changeState(portal: PortalKey, action: "pause" | "close" | "activate") {
    setBusy(`state:${portal}`);
    try {
      const res = await fetch(`/api/integrations/portales/${portal}/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "No se pudo cambiar el estado");
      toast.success(body?.message ?? "Estado actualizado");
      await load();
      // ArgenProp y ZonaProp los aplica el worker async → refrescar de nuevo en unos segundos.
      if (portal !== "mercadolibre") setTimeout(() => void load(), 7000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cambiar el estado");
    } finally {
      setBusy(null);
    }
  }

  function toggle(portal: PortalKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(portal)) next.delete(portal);
      else next.add(portal);
      return next;
    });
  }

  const isSelectable = (portal: PortalKey) => {
    const meta = PORTAL_META[portal];
    const pub = pubs[portal];
    const ready = readiness?.[portal];
    const notReady = meta.publishable && !pub?.published && ready ? !ready.ok : false;
    return meta.publishable && !notReady;
  };
  const selectableCount = ORDER.filter(isSelectable).length;
  const selectedCount = [...selected].filter(isSelectable).length;
  const zpPlanCredit = credits?.plans.find((pl) => pl.plan === zpPlan);

  const BTN = "inline-flex h-11 w-full items-center justify-center rounded-full px-3 text-[13px] font-bold transition-opacity disabled:opacity-50";
  const BTN_PRIMARY = `${BTN} bg-dark text-dark-fg hover:opacity-90`;
  const BTN_SECONDARY = `${BTN} border border-border bg-surface text-text hover:bg-bg`;
  const BTN_DANGER = `${BTN} bg-clay-chip text-terra hover:opacity-80`;
  const FIELD_LABEL = "mb-1 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-faint";
  const FIELD = "h-10 w-full rounded-[12px] border border-border bg-bg px-3 text-[13px] font-semibold text-text disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-text-faint">Publicá este aviso en cada portal.</p>
        <button
          onClick={() => void load()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg"
          aria-label="Actualizar"
          title="Actualizar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-text-faint">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 11-6.22-8.56" />
          </svg>
          Cargando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
            {ORDER.map((portal) => {
              const meta = PORTAL_META[portal];
              const c = connOf(portal);
              const pub = pubs[portal];
              const ready = readiness?.[portal];
              // Bloquea publicar sólo si aún no hay aviso creado y faltan campos.
              const notReady = meta.publishable && !pub?.published && ready ? !ready.ok : false;
              const chip = pub ? STATUS_CHIP[pub.status] : null;
              const selectable = isSelectable(portal);
              const isSel = selectable && selected.has(portal);
              const canToggle = selectable && busy === null;
              const disconnected = !c?.connected && portal !== "mercadolibre";
              const publishBusy = busy !== null || pub?.status === "publishing";

              return (
                <div
                  key={portal}
                  role={selectable ? "checkbox" : undefined}
                  aria-checked={selectable ? isSel : undefined}
                  aria-label={selectable ? `Seleccionar ${meta.label} para publicación grupal` : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  onClick={
                    canToggle
                      ? (e) => {
                          if ((e.target as Element).closest("button, select, a, label")) return;
                          toggle(portal);
                        }
                      : undefined
                  }
                  onKeyDown={
                    canToggle
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggle(portal);
                          }
                        }
                      : undefined
                  }
                  className={`relative overflow-hidden rounded-[18px] border bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark ${
                    isSel ? "border-dark ring-1 ring-dark" : "border-border"
                  } ${canToggle ? "cursor-pointer active:bg-bg" : ""}`}
                >
                  {/* Identidad */}
                  <div className="flex items-center gap-2.5 p-3 pb-2">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold text-white"
                      style={{ backgroundColor: meta.dot }}
                      aria-hidden
                    >
                      {meta.label[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] font-semibold leading-tight text-text">{meta.label}</div>
                      <div
                        className={`mt-0.5 flex items-center gap-1 text-[11px] ${c?.connected ? "text-olive-light" : "text-terra"}`}
                        title={c?.actionHint ?? undefined}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                        <span className="truncate">{c?.connected ? "Conectado" : c?.actionHint ?? "Sin conexión"}</span>
                      </div>
                    </div>
                    {selectable && (
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSel ? "border-dark bg-dark text-dark-fg" : "border-border-strong bg-surface"
                        }`}
                        aria-hidden
                      >
                        {isSel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Cupo ZonaProp (los pagos son por fuera de la app). */}
                  {portal === "zonaprop" && credits && (
                    <div
                      className="flex flex-wrap items-center gap-1.5 px-3 pb-2"
                      title={credits.fetchedAt ? `Actualizado: ${new Date(credits.fetchedAt).toLocaleString("es-AR")}` : undefined}
                    >
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-faint">Cupo</span>
                      {credits.plans.length ? (
                        credits.plans.map((pl) => (
                          <span key={pl.plan} className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-text">
                            {pl.label}
                            <span className={pl.available === 0 ? "text-terra" : "text-olive-light"}>{pl.available ?? "—"}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-text-faint">{credits.error ? "Sin datos (error al leer)" : "Sin datos aún"}</span>
                      )}
                      <button
                        onClick={() => void refreshCredits()}
                        disabled={refreshingCredits}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg disabled:opacity-50"
                        aria-label="Actualizar cupo"
                        title="Actualizar cupo"
                      >
                        <svg className={refreshingCredits ? "animate-spin" : undefined} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 11-2.64-6.36" />
                          <path d="M21 3v6h-6" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Conexión caída — login remoto (ML usa OAuth) */}
                  {disconnected && (
                    <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-[12px] bg-clay-chip px-3 py-2 text-[11.5px] text-terra">
                      <span>Sesión vencida</span>
                      <button
                        onClick={() => void startRelogin(portal)}
                        disabled={busy !== null}
                        className="rounded-full border border-terra/40 bg-surface px-3 py-1 text-[11.5px] font-bold text-terra transition-colors hover:bg-terra hover:text-white disabled:opacity-50"
                        title="Abrí una ventana para loguearte de nuevo en el portal"
                      >
                        {busy === `relogin:${portal}` ? "Abriendo…" : "Reconectar"}
                      </button>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="space-y-2 px-3 pb-3">
                    {/* Pausar / Reactivar / Dar de baja — sobre avisos ya publicados (ZP, AP y ML) */}
                    {pub?.published && (pub.status === "active" || pub.status === "paused") && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            const activate = pub.status !== "active";
                            setConfirm({
                              title: activate ? "¿Reactivar aviso?" : "¿Pausar aviso?",
                              body: activate
                                ? portal === "zonaprop"
                                  ? `Republica el aviso en ZonaProp con el plan ${ZP_PLAN_LABEL(zpPlan)} (usa cupo). Lo aplica el worker en unos minutos.`
                                  : `Vuelve a poner el aviso activo en ${meta.label}.`
                                : portal === "zonaprop"
                                  ? "Finaliza el aviso en ZonaProp (queda OFFLINE; se puede republicar después, usando cupo). Lo aplica el worker en unos minutos."
                                  : `Pausa el aviso en ${meta.label} (se puede reactivar después).`,
                              cta: activate ? "Reactivar" : "Pausar",
                              run: () => void changeState(portal, activate ? "activate" : "pause"),
                            });
                          }}
                          disabled={busy !== null}
                          className={BTN_SECONDARY}
                          title={pub.status === "active" ? "Pausa el aviso (se puede reactivar)" : "Vuelve a poner el aviso activo"}
                        >
                          {busy === `state:${portal}` ? "Aplicando…" : pub.status === "active" ? "Pausar" : "Reactivar"}
                        </button>
                        <button
                          onClick={() =>
                            setConfirm({
                              title: "¿Dar de baja el aviso?",
                              body:
                                portal === "mercadolibre"
                                  ? "Cierra la publicación en MercadoLibre de forma IRREVERSIBLE (para volver hay que republicar desde el wizard)."
                                  : portal === "zonaprop"
                                    ? "Archiva el aviso en ZonaProp (para volver hay que publicarlo de nuevo). Lo aplica el worker en unos minutos."
                                    : "Elimina el aviso de ArgenProp.",
                              cta: "Dar de baja",
                              danger: true,
                              run: () => void changeState(portal, "close"),
                            })
                          }
                          disabled={busy !== null}
                          className={BTN_DANGER}
                          title={portal === "mercadolibre" ? "Cierra la publicación (irreversible en ML)" : "Elimina el aviso de ArgenProp"}
                        >
                          Dar de baja
                        </button>
                      </div>
                    )}

                    {meta.publishable ? (
                      notReady ? (
                        <div>
                          <p className="mb-1.5 text-[11.5px] text-text-muted">Faltan datos para publicar (completalos en Datos / Ubicación):</p>
                          <div className="flex flex-wrap gap-1">
                            {ready?.faltan.map((x) => (
                              <span key={x.campo} className="rounded-full bg-sand-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
                                {x.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : portal === "zonaprop" ? (
                        <>
                          <div>
                            <label className={FIELD_LABEL} htmlFor={`zp-plan-${propertyId}`}>Plan</label>
                            <select
                              id={`zp-plan-${propertyId}`}
                              value={zpPlan}
                              onChange={(e) => setZpPlan(e.target.value)}
                              disabled={publishBusy}
                              className={FIELD}
                              title="Exposición del aviso al publicarlo activo (a más exposición, más crédito)"
                            >
                              {ZP_PLANS.map((pl) => (
                                <option key={pl.value} value={pl.value}>
                                  {pl.label}
                                </option>
                              ))}
                            </select>
                            {zpPlanCredit && zpPlanCredit.available !== null && (
                              <p className={`mt-1 text-[11px] font-semibold ${zpPlanCredit.available === 0 ? "text-terra" : "text-olive-light"}`}>
                                {zpPlanCredit.available === 0 ? "Sin cupo en este plan" : `Cupo disponible: ${zpPlanCredit.available}`}
                              </p>
                            )}
                          </div>
                          {responsibles.length > 0 && (
                            <div>
                              <label className={FIELD_LABEL} htmlFor={`zp-resp-${propertyId}`}>Responsable</label>
                              <select
                                id={`zp-resp-${propertyId}`}
                                value={respUserId}
                                onChange={(e) => setRespUserId(e.target.value)}
                                disabled={publishBusy}
                                className={FIELD}
                                title="Responsable del aviso (quién recibe las consultas)"
                              >
                                <option value="">Por defecto</option>
                                {responsibles.map((r) => (
                                  <option key={r.userId} value={String(r.userId)}>
                                    {r.name} {r.lastName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() =>
                                setConfirm({
                                  title: "¿Crear borrador?",
                                  body: `Crea el aviso como borrador en ${meta.label} (gratis, no consume crédito).`,
                                  cta: "Crear borrador",
                                  run: () => void publishOne(portal, false),
                                })
                              }
                              disabled={publishBusy}
                              className={BTN_SECONDARY}
                              title="Crea el aviso como borrador (gratis)"
                            >
                              Borrador
                            </button>
                            <button
                              onClick={() =>
                                setConfirm({
                                  title: "¿Publicar activo en ZonaProp?",
                                  body: `Pone el aviso ONLINE y CONSUME 1 crédito del plan ${ZP_PLAN_LABEL(zpPlan)}.`,
                                  cta: "Publicar activo",
                                  danger: true,
                                  run: () => void publishOne(portal, true),
                                })
                              }
                              disabled={publishBusy}
                              className={BTN_PRIMARY}
                              title="Publica el aviso ONLINE — consume 1 crédito del plan elegido"
                            >
                              Publicar activo
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            setConfirm({
                              title: "¿Publicar en ArgenProp?",
                              body: "Crea y publica el aviso en ArgenProp (no tiene borrador).",
                              cta: "Publicar",
                              run: () => void publishOne(portal, false),
                            })
                          }
                          disabled={publishBusy}
                          className={BTN_PRIMARY}
                          title="Crea y publica el aviso en ArgenProp (no tiene borrador)"
                        >
                          Publicar en ArgenProp
                        </button>
                      )
                    ) : (
                      !pub?.published && <p className="text-[11.5px] text-text-faint">Se publica desde el wizard de MercadoLibre.</p>
                    )}
                  </div>

                  {/* Footer de estado = franja de color */}
                  <div className={`border-t border-border px-3 py-1.5 text-[11.5px] font-bold ${chip ? chip.cls : "bg-bg text-text-faint"}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full bg-current opacity-70 ${pub?.status === "publishing" ? "animate-pulse" : ""}`} aria-hidden />
                      {chip ? chip.label : "Sin publicar"}
                      {pub?.permalink && (
                        <a
                          href={pub.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-0.5 underline"
                        >
                          Ver aviso
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7" />
                            <path d="M7 7h10v10" />
                          </svg>
                        </a>
                      )}
                    </div>
                    {pub?.lastError && <p className="mt-0.5 line-clamp-1 font-normal opacity-80" title={pub.lastError}>{pub.lastError}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCount === 0 && selectableCount >= 2 && (
            <p className="text-center text-[11.5px] text-text-faint">Tocá una card para publicar en varios portales a la vez.</p>
          )}

          {/* Acción grupal */}
          <AnimatePresence>
            {selectedCount > 0 && (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="sticky bottom-0 z-10 -mx-5 bg-gradient-to-t from-surface via-surface to-transparent px-5 pb-1 pt-4"
              >
                <div className="flex items-center justify-between gap-3 rounded-full bg-dark py-2 pl-5 pr-2 text-dark-fg shadow-lg">
                  <span className="text-[13px] font-semibold">
                    {selectedCount} {selectedCount === 1 ? "portal seleccionado" : "portales seleccionados"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelected(new Set())}
                      disabled={busy !== null}
                      className="px-3 text-[12.5px] font-semibold opacity-70 hover:opacity-100 disabled:opacity-40"
                    >
                      Quitar
                    </button>
                    <button
                      onClick={() =>
                        setConfirm({
                          title: "¿Publicar en grupo?",
                          body: `Encola la publicación en ${selected.size} portal(es) seleccionado(s).`,
                          cta: "Publicar",
                          run: () => void publishSelected(),
                        })
                      }
                      disabled={!selected.size || busy !== null}
                      className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[12.5px] font-bold text-text transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === "bulk" ? "Publicando…" : "Publicar"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Confirmación de publicar / cambiar estado */}
      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        maxWidth="sm:max-w-sm"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <button
              onClick={() => setConfirm(null)}
              className="px-2 text-[13px] font-semibold text-text-faint hover:text-text"
            >
              Cancelar
            </button>
            <button
              onClick={() => { confirm?.run(); setConfirm(null); }}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] font-bold transition-opacity hover:opacity-90 ${confirm?.danger ? "bg-clay-chip text-terra" : "bg-dark text-dark-fg"}`}
            >
              {confirm?.cta ?? "Confirmar"}
            </button>
          </div>
        }
      >
        <p className="text-[13.5px] text-text-muted">{confirm?.body}</p>
      </Sheet>

      {/* Modal de login remoto: transmite el navegador del worker (noVNC). */}
      {relogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h4 className="text-[14px] font-bold text-text">Reconectar {PORTAL_META[relogin.portal].label}</h4>
                <p className="text-[11.5px] text-text-faint">
                  Logueate en la ventana (usuario, clave y captcha si aparece). Cuando estés adentro, apretá “Ya entré”.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void cancelRelogin()}
                  disabled={busy === "relogin:finish"}
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-[12px] font-bold text-text-muted hover:bg-surface disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void finishRelogin()}
                  disabled={busy === "relogin:finish"}
                  className="rounded-full bg-dark px-3.5 py-1.5 text-[12px] font-bold text-dark-fg hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "relogin:finish" ? "Verificando…" : "Ya entré"}
                </button>
              </div>
            </div>
            <iframe
              src={relogin.viewUrl}
              title="Login remoto del portal"
              className="min-h-0 flex-1 bg-[#1a1a1a]"
              // El visor sólo necesita ejecutar su script y aceptar teclado/mouse.
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
