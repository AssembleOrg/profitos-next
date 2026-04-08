"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface DashboardOverview {
  scope: "admin" | "user";
  generatedAt: string;
  days: 1 | 7 | 30;
  kpis: {
    propertiesTotal: number;
    propertiesNew7d: number;
    contactsNew7d: number;
    pendingPropertyFollowUps: number;
    pendingContactFollowUps: number;
    overduePropertyFollowUps: number;
  };
  statusBreakdown: {
    pendiente: number;
    iniciada: number;
    activa: number;
    cerrada: number;
  };
  lastProperties: Array<{
    id: string;
    address: string;
    city: string | null;
    type: string | null;
    status: string;
    operationType: string | null;
    operationPrice: number | null;
    operationCurrency: string | null;
    createdAt: string;
  }>;
  lastContacts: Array<{
    id: string;
    name: string;
    email: string | null;
    cellphone: string | null;
    phone: string | null;
    leadStatus: string | null;
    agentName: string | null;
    tokkoCreatedAt: string | null;
  }>;
  recentFollowUps: Array<{
    kind: "propiedad" | "consulta";
    id: string;
    title: string;
    status: string;
    responsible: string;
    updatedAt: string;
  }>;
  recentActions: Array<{
    kind: "propiedad" | "consulta";
    id: string;
    type: string;
    description: string;
    title: string;
    author: string;
    actionAt: string;
  }>;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(d);
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-2 text-4xl font-light tracking-tight text-text">{value}</p>
      <p className="mt-2 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

export function DashboardOverviewClient() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<1 | 7 | 30>(7);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/overview?days=${selectedDays}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.message ?? "No se pudo cargar dashboard");
        }
        if (mounted) setData(body.data as DashboardOverview);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "No se pudo cargar dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [selectedDays]);

  const scopeLabel = useMemo(() => {
    if (!data) return "";
    return data.scope === "admin" ? "Vista global (admin)" : "Vista personal (empleado)";
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-surface/30" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-surface/40 p-6">
        <p className="text-sm text-red-300">{error ?? "No se pudo cargar dashboard"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Resumen</p>
            <p className="mt-1 text-sm text-text">
              {scopeLabel} · Actualizado: {formatDateTime(data.generatedAt)}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg/50 p-1">
            {[1, 7, 30].map((days) => (
              <button
                key={days}
                onClick={() => setSelectedDays(days as 1 | 7 | 30)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedDays === days
                    ? "bg-secondary/20 text-secondary"
                    : "text-text-muted hover:bg-surface hover:text-text"
                }`}
              >
                {days === 1 ? "Hoy" : `${days} días`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Propiedades"
          value={data.kpis.propertiesTotal}
          hint={`+${data.kpis.propertiesNew7d} en los últimos ${selectedDays} día${selectedDays === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Contactos"
          value={data.kpis.contactsNew7d}
          hint={`Nuevos en los últimos ${selectedDays} día${selectedDays === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Seguimientos Prop."
          value={data.kpis.pendingPropertyFollowUps}
          hint={`${data.kpis.overduePropertyFollowUps} vencidos`}
        />
        <KpiCard
          label="Seg. Consultas"
          value={data.kpis.pendingContactFollowUps}
          hint="Pendiente + iniciada + activa"
        />
        <KpiCard
          label="Consultas Activas"
          value={data.statusBreakdown.activa}
          hint={`Pend: ${data.statusBreakdown.pendiente} · Ini: ${data.statusBreakdown.iniciada}`}
        />
        <KpiCard
          label="Consultas Cerradas"
          value={data.statusBreakdown.cerrada}
          hint="Cierre total en seguimiento de consultas"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text">Últimas 5 propiedades</h3>
            <Link href="/propiedades" className="text-xs text-secondary">Ver todo</Link>
          </div>
          <div className="space-y-2">
            {data.lastProperties.length === 0 ? (
              <p className="text-sm text-text-muted">Sin propiedades.</p>
            ) : (
              data.lastProperties.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-bg/30 px-3 py-2">
                  <p className="truncate text-sm text-text">{item.address}</p>
                  <p className="truncate text-xs text-text-muted">
                    {item.operationType ?? "Operación"} · {item.operationCurrency ?? ""} {item.operationPrice?.toLocaleString("es-AR") ?? "s/d"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text">Últimos 5 contactos</h3>
            <Link href="/consultants" className="text-xs text-secondary">Ver todo</Link>
          </div>
          <div className="space-y-2">
            {data.lastContacts.length === 0 ? (
              <p className="text-sm text-text-muted">Sin contactos.</p>
            ) : (
              data.lastContacts.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-bg/30 px-3 py-2">
                  <p className="truncate text-sm text-text">{item.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {item.leadStatus ?? "Sin estado"} · {item.agentName ?? "Sin agente"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text">Seguimientos recientes</h3>
            <Link href="/consultants-followups" className="text-xs text-secondary">Ver consultas</Link>
          </div>
          <div className="space-y-2">
            {data.recentFollowUps.length === 0 ? (
              <p className="text-sm text-text-muted">Sin seguimientos.</p>
            ) : (
              data.recentFollowUps.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-border/60 bg-bg/30 px-3 py-2">
                  <p className="truncate text-sm text-text">{item.title}</p>
                  <p className="truncate text-xs text-text-muted">
                    {item.kind} · {item.status} · {item.responsible}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text">Acciones recientes</h3>
          <Link href="/consultants-followups" className="text-xs text-secondary">Ver seguimientos</Link>
        </div>
        <div className="space-y-2">
          {data.recentActions.length === 0 ? (
            <p className="text-sm text-text-muted">Sin acciones recientes.</p>
          ) : (
            data.recentActions.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-border/60 bg-bg/30 px-3 py-2">
                <p className="truncate text-sm text-text">{item.title}</p>
                <p className="truncate text-xs text-text-muted">
                  [{item.kind}] {item.type} · {item.author}
                </p>
                <p className="truncate text-xs text-text-muted/80">{item.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
