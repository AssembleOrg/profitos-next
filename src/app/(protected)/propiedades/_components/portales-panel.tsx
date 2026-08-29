"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [statusData, pubData] = await Promise.all([
      getJson<{ portals: ConnStatus[] }>("/api/integrations/portales/status"),
      getJson<{ publications: Publication[] }>(`/api/integrations/portales/publications/${propertyId}`),
    ]);
    if (statusData) setConn(statusData.portals);
    if (pubData) {
      const map: Record<string, Publication> = {};
      for (const p of pubData.publications) map[p.portal] = p;
      setPubs(map);
    }
    setLoading(false);
  }, [propertyId]);

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
    if (
      activate &&
      !window.confirm(
        `Publicar en ${PORTAL_META[portal].label} pone el aviso ONLINE y CONSUME 1 crédito` +
          (plan ? ` del plan ${ZP_PLAN_LABEL(plan)}` : "") +
          `. ¿Confirmás?`
      )
    )
      return;
    setBusy(portal);
    try {
      const res = await fetch(`/api/integrations/portales/${portal}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, activate, plan }),
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

  function toggle(portal: PortalKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(portal)) next.delete(portal);
      else next.add(portal);
      return next;
    });
  }

  return (
    <div className="rounded-[16px] border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-text-faint">Portales</h3>
        <button onClick={() => void load()} className="text-[12px] font-semibold text-text-muted hover:text-text">
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-[12.5px] text-text-faint">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {ORDER.map((portal) => {
            const meta = PORTAL_META[portal];
            const c = connOf(portal);
            const pub = pubs[portal];
            const chip = pub ? STATUS_CHIP[pub.status] : null;
            return (
              <div key={portal} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-bg px-3 py-2.5">
                <span className="flex items-center gap-2 font-semibold text-text">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden />
                  {meta.label}
                </span>

                {/* Conexión */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    c?.connected ? "bg-sage-chip text-olive-light" : "bg-clay-chip text-terra"
                  }`}
                  title={c?.actionHint ?? undefined}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${c?.connected ? "bg-olive-light" : "bg-terra"}`} aria-hidden />
                  {c?.connected ? "Conectado" : c?.actionHint ?? "Sin conexión"}
                </span>

                {/* Reconectar (login remoto) — sólo ZonaProp/ArgenProp; ML usa OAuth */}
                {!c?.connected && portal !== "mercadolibre" && (
                  <button
                    onClick={() => void startRelogin(portal)}
                    disabled={busy !== null}
                    className="rounded-full border border-terra/40 bg-clay-chip px-2.5 py-0.5 text-[11px] font-bold text-terra transition-colors hover:bg-terra hover:text-white disabled:opacity-50"
                    title="Abrí una ventana para loguearte de nuevo en el portal"
                  >
                    {busy === `relogin:${portal}` ? "Abriendo…" : "Reconectar"}
                  </button>
                )}

                {/* Estado publicación */}
                {chip ? (
                  pub?.permalink ? (
                    <a href={pub.permalink} target="_blank" rel="noopener noreferrer" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold hover:underline ${chip.cls}`} title={pub.lastError ?? undefined}>
                      {chip.label}
                    </a>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chip.cls}`} title={pub.lastError ?? undefined}>
                      {chip.label}
                    </span>
                  )
                ) : (
                  <span className="rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-semibold text-text-faint">Sin publicar</span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {meta.publishable ? (
                    <>
                      <input
                        type="checkbox"
                        checked={selected.has(portal)}
                        onChange={() => toggle(portal)}
                        className="h-4 w-4 accent-dark"
                        aria-label={`Seleccionar ${meta.label} para publicación grupal`}
                      />
                      <button
                        onClick={() => void publishOne(portal, false)}
                        disabled={busy !== null || pub?.status === "publishing"}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-bold text-text transition-colors hover:bg-bg disabled:opacity-50"
                        title={
                          portal === "argenprop"
                            ? "Crea y publica el aviso en ArgenProp (no tiene borrador)"
                            : "Crea el aviso como borrador (gratis)"
                        }
                      >
                        {portal === "argenprop" ? "Publicar" : "Borrador"}
                      </button>
                      {portal === "zonaprop" && (
                        <>
                          <select
                            value={zpPlan}
                            onChange={(e) => setZpPlan(e.target.value)}
                            disabled={busy !== null || pub?.status === "publishing"}
                            className="rounded-full border border-border bg-surface px-2 py-1.5 text-[11.5px] font-semibold text-text-muted disabled:opacity-50"
                            title="Exposición del aviso al publicarlo activo (a más exposición, más crédito)"
                            aria-label="Plan de exposición ZonaProp"
                          >
                            {ZP_PLANS.map((pl) => (
                              <option key={pl.value} value={pl.value}>
                                {pl.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void publishOne(portal, true)}
                            disabled={busy !== null || pub?.status === "publishing"}
                            className="rounded-full bg-dark px-3 py-1.5 text-[12px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                            title="Publica el aviso ONLINE — consume 1 crédito del plan elegido"
                          >
                            Publicar activo
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-text-faint">Usá el wizard ML</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Acción grupal */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11.5px] text-text-faint">
              {selected.size ? `${selected.size} portal(es) seleccionado(s)` : "Marcá portales para publicar en grupo"}
            </p>
            <button
              onClick={() => void publishSelected()}
              disabled={!selected.size || busy !== null}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-bold text-text transition-colors hover:bg-bg disabled:opacity-50"
            >
              Publicar seleccionados
            </button>
          </div>
        </div>
      )}

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
