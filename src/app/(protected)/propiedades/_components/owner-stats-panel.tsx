"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { OwnerReportStats } from "@/lib/reports/owner-stats";
import { trendLabel } from "@/lib/reports/owner-stats-calc";

/**
 * Vista previa de los datos automáticos del informe al propietario: lo que
 * ZonaProp informa del aviso + consultas que entraron a Profitos. "Actualizar"
 * le pide al worker que los traiga ya (abre el navegador: ~30-60 s).
 */

type Loaded = OwnerReportStats & { refresh?: { ok: boolean; error?: string } };

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("es-AR"));

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("es-AR", { month: "long", timeZone: "UTC" });
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string | null; tone?: "up" | "down" | "equal" }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-3 py-2.5">
      <div className="text-[11.5px] font-semibold leading-tight text-text-muted">{label}</div>
      <div className="mt-0.5 text-[20px] font-bold leading-tight tabular-nums text-text">{value}</div>
      {hint && (
        <div className={`mt-0.5 text-[11px] leading-tight ${tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-text-faint"}`}>{hint}</div>
      )}
    </div>
  );
}

export function OwnerStatsPanel({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/propiedades/${propertyId}/estadisticas`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && setData(j.data ?? null))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [propertyId]);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/propiedades/${propertyId}/estadisticas`, { method: "POST" });
      const j = await res.json();
      if (j.data) setData(j.data);
      if (j.data?.refresh?.ok) toast.success("Datos de ZonaProp actualizados");
      else toast.error(j.data?.refresh?.error ?? j.message ?? "No se pudo actualizar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-[14px] bg-surface-elevated" />
        ))}
      </div>
    );
  }

  const z = data?.zonaprop;
  const hasZp = !!z?.fetchedAt;
  const inq = data?.inquiries;

  return (
    <section className="flex flex-col gap-2.5" aria-label="Datos automáticos del informe">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-bold text-text">ZonaProp · últimos 30 días</h3>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 text-[12.5px] font-semibold text-primary underline-offset-2 active:underline disabled:text-text-faint"
        >
          {refreshing ? "Consultando ZonaProp…" : "Actualizar"}
        </button>
      </div>

      {hasZp ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Visitas al aviso" value={n(z!.visits30)} hint={trendLabel(z!.trend?.visits)} tone={z!.trend?.visits?.dir} />
            <Stat label="Consultas" value={n(z!.contacts30)} hint={trendLabel(z!.trend?.contacts)} tone={z!.trend?.contacts?.dir} />
            <Stat label={`Visitas en ${monthLabel(z!.thisMonth.month)}`} value={n(z!.thisMonth.views)} />
            <Stat label="Visitas desde que se publicó" value={n(z!.totalVisits)} />
          </div>
          <p className="text-[11.5px] leading-snug text-text-faint">
            Aviso {z!.externalId} · datos al {when(z!.fetchedAt)}
            {z!.error ? " · la última consulta no trajo datos" : ""}. Se actualizan solos una vez por día.
          </p>
        </>
      ) : (
        <p className="rounded-[14px] border border-dashed border-border px-3.5 py-3 text-[12.5px] leading-snug text-text-muted">
          {z?.error
            ? "ZonaProp no devolvió datos de este aviso en la última consulta. Probá «Actualizar»."
            : "Todavía no hay datos de ZonaProp para esta propiedad (no tiene aviso vinculado o aún no se descargaron). Probá «Actualizar»."}
        </p>
      )}

      {inq && inq.total > 0 && (
        <p className="text-[12.5px] text-text-muted">
          Consultas en Profitos: <span className="font-semibold text-text">{n(inq.last30)}</span> en 30 días ·{" "}
          {inq.byPortal.map((p) => `${p.label} ${n(p.total)}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
