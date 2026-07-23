"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { WhatsAppLink } from "@/components/whatsapp-link";

interface InformeData {
  member: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  dateRange: { from: string; to: string };
  resumen: {
    tasaResolucion: number | null;
    actividadPorDia: number;
    totalAcciones: number;
    contactosGestionados: number;
    segVencidos: number;
    estadoGeneral: "alto" | "moderado" | "bajo";
  };
  kpis: {
    segPropAsignados: number;
    segPropCompletados: number;
    segContactosAsignados: number;
    visitasRealizadas: number;
    clientesCreados: number;
    totalAcciones: number;
    cambiosEstado: number;
  };
  breakdowns: {
    segPropPorEstado: Record<string, number>;
    segContactosPorEstado: Record<string, number>;
    accionesPorTipo: Record<string, number>;
  };
  seguimientosProp: Array<{
    id: string;
    title: string | null;
    status: string;
    dueDate: string | null;
    createdAt: string;
    property: { id: string; address: string };
    _count: { actions: number };
  }>;
  seguimientosContacto: Array<{
    id: string;
    status: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    recentContact: { id: string; name: string; email: string | null; cellphone: string | null; phone: string | null };
    _count: { actions: number };
    statusChanges: Array<{ fromStatus: string; toStatus: string; createdAt: string }>;
  }>;
  visitas: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
    property: { id: string; address: string } | null;
    client: { id: string; name: string } | null;
  }>;
  clientes: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    createdAt: string;
    _count: { visitas: number };
  }>;
  timeline: Array<{
    kind: string;
    date: string;
    type: string;
    description: string;
    entity: string;
  }>;
}

interface Props {
  memberId: string;
  from: string;
  to: string;
}

const ESTADO_CONFIG = {
  alto: { label: "Alta actividad", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  moderado: { label: "Actividad moderada", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  bajo: { label: "Baja actividad", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
};

const STATUS_COLORS: Record<string, string> = {
  pendiente: "bg-amber-500",
  hecho: "bg-emerald-500",
  cancelado: "bg-red-500",
  iniciada: "bg-sky-500",
  activa: "bg-emerald-500",
  cerrada: "bg-text-muted",
  en_progreso: "bg-sky-500",
};

const TIMELINE_COLORS: Record<string, string> = {
  accion_seguimiento: "border-amber-500/30 bg-amber-500/5",
  accion_contacto: "border-fuchsia-500/30 bg-fuchsia-500/5",
  cambio_estado: "border-sky-500/30 bg-sky-500/5",
  visita: "border-emerald-500/30 bg-emerald-500/5",
};

const TIMELINE_LABELS: Record<string, string> = {
  accion_seguimiento: "Seg. propiedad",
  accion_contacto: "Seg. contacto",
  cambio_estado: "Cambio estado",
  visita: "Visita",
};

export function InformeClient({ memberId, from, to }: Props) {
  const router = useRouter();
  const [data, setData] = useState<InformeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/miembros/${memberId}/informe?from=${from}&to=${to}`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.message ?? "Error al cargar informe");
          return;
        }
        setData(body.data);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [memberId, from, to]);

  function applyDateRange() {
    router.push(`/miembros/${memberId}/informe?from=${fromDate}&to=${toDate}`);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/miembros" className="text-sm text-secondary hover:underline">
          &larr; Volver a miembros
        </Link>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center text-sm text-red-400">
          {error ?? "No se pudo cargar el informe"}
        </div>
      </div>
    );
  }

  const { member, resumen, kpis, breakdowns } = data;
  const estadoConfig = ESTADO_CONFIG[resumen.estadoGeneral];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/miembros"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary">
                {member.email[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-text">
                {member.fullName ?? member.email}
              </h1>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(member.email);
                    toast.success("Mail copiado");
                  }}
                  className="truncate text-xs text-text-muted transition-colors hover:text-text"
                  title="Copiar mail"
                >
                  {member.email}
                </button>
                <span className="shrink-0 text-xs text-text-faint">· {member.role}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            aria-label="Desde"
            className="min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
          />
          <span className="text-xs text-text-muted">a</span>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            aria-label="Hasta"
            className="min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
          />
          <button
            onClick={applyDateRange}
            className="rounded-lg bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
          >
            Aplicar
          </button>
          <a
            href={`/api/miembros/${memberId}/informe/pdf?from=${fromDate}&to=${toDate}`}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar PDF
          </a>
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-5 ${estadoConfig.bg}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className={`text-sm font-semibold ${estadoConfig.color}`}>{estadoConfig.label}</span>
          <span className="text-xs text-text-muted">· {formatDate(data.dateRange.from)} — {formatDate(data.dateRange.to)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <p className="text-2xl font-bold text-text">{resumen.tasaResolucion === null ? "—" : `${resumen.tasaResolucion}%`}</p>
            <p className="text-xs text-text-muted">Tasa resolución</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{resumen.actividadPorDia}</p>
            <p className="text-xs text-text-muted">Acciones/día</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{resumen.contactosGestionados}</p>
            <p className="text-xs text-text-muted">Contactos gestionados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{resumen.totalAcciones}</p>
            <p className="text-xs text-text-muted">Acciones totales</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${resumen.segVencidos > 0 ? "text-red-400" : "text-text"}`}>{resumen.segVencidos}</p>
            <p className="text-xs text-text-muted">Seg. vencidos</p>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Seg. propiedades", value: kpis.segPropAsignados },
          { label: "Completados", value: kpis.segPropCompletados },
          { label: "Seg. contactos", value: kpis.segContactosAsignados },
          { label: "Visitas", value: kpis.visitasRealizadas },
          { label: "Clientes creados", value: kpis.clientesCreados },
          { label: "Cambios estado", value: kpis.cambiosEstado },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xl font-bold text-text">{kpi.value}</p>
            <p className="text-xs text-text-muted">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Seg. propiedades por estado */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Seg. propiedades por estado</h3>
          {Object.keys(breakdowns.segPropPorEstado).length === 0 ? (
            <p className="text-sm text-text-faint">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(breakdowns.segPropPorEstado).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-text-muted"}`} />
                    <span className="text-sm capitalize text-text">{status}</span>
                  </div>
                  <span className="text-sm font-medium text-text">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seg. contactos por estado */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Seg. contactos por estado</h3>
          {Object.keys(breakdowns.segContactosPorEstado).length === 0 ? (
            <p className="text-sm text-text-faint">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(breakdowns.segContactosPorEstado).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-text-muted"}`} />
                    <span className="text-sm capitalize text-text">{status}</span>
                  </div>
                  <span className="text-sm font-medium text-text">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones por tipo */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Acciones por tipo</h3>
          {Object.keys(breakdowns.accionesPorTipo).length === 0 ? (
            <p className="text-sm text-text-faint">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(breakdowns.accionesPorTipo).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm capitalize text-text">{type}</span>
                  <span className="text-sm font-medium text-text">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contactos gestionados */}
      {data.seguimientosContacto.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Contactos gestionados ({data.seguimientosContacto.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.seguimientosContacto.map((s) => {
              const contactInfo = s.recentContact.email ?? s.recentContact.cellphone ?? s.recentContact.phone ?? null;
              const isEmail = !!s.recentContact.email;
              const lastChange = s.statusChanges.length > 0
                ? s.statusChanges[0]
                : null;
              const validChange = lastChange && lastChange.fromStatus && lastChange.toStatus
                ? `${lastChange.fromStatus} → ${lastChange.toStatus}`
                : null;
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{s.recentContact.name}</p>
                    <div className="flex flex-wrap items-center gap-x-1 text-xs text-text-muted">
                      {contactInfo ? (
                        isEmail ? (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(contactInfo);
                              toast.success("Mail copiado");
                            }}
                            className="truncate transition-colors hover:text-text"
                            title="Copiar mail"
                          >
                            {contactInfo}
                          </button>
                        ) : (
                          <span className="truncate">{contactInfo}</span>
                        )
                      ) : (
                        <span>Sin contacto</span>
                      )}
                      <span>·</span>
                      <span>{s._count.actions} accion{s._count.actions !== 1 ? "es" : ""}</span>
                      {validChange && (
                        <>
                          <span>·</span>
                          <span>Último cambio: {validChange}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[s.status] ?? "bg-text-muted"}`} />
                    <span className="text-xs capitalize text-text-muted">{s.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seguimientos de propiedades */}
      {data.seguimientosProp.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Seguimientos de propiedades ({data.seguimientosProp.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.seguimientosProp.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{s.property.address}</p>
                  <p className="text-xs text-text-muted">
                    {s.title ?? "Sin título"}
                    {" · "}{s._count.actions} accion{s._count.actions !== 1 ? "es" : ""}
                    {s.dueDate && ` · Vence: ${formatDate(s.dueDate)}`}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[s.status] ?? "bg-text-muted"}`} />
                  <span className="text-xs capitalize text-text-muted">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visitas */}
      {data.visitas.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Visitas ({data.visitas.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.visitas.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{v.title}</p>
                  <p className="text-xs text-text-muted">
                    {v.property?.address ?? "Sin propiedad"}
                    {v.client ? ` · ${v.client.name}` : ""}
                    {" · "}{v.startTime} - {v.endTime}
                  </p>
                </div>
                <span className="ml-3 text-xs text-text-muted">{formatDate(v.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clientes creados */}
      {data.clientes.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Clientes creados ({data.clientes.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.clientes.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{c.name}</p>
                  <p className="text-xs text-text-muted">
                    {c.email ?? (c.phone ? (
                      <WhatsAppLink
                        phone={c.phone}
                        className="inline-flex items-center gap-1 align-middle transition-colors hover:text-green-500"
                      >
                        {c.phone}
                      </WhatsAppLink>
                    ) : "Sin contacto")}
                    {" · "}{c._count.visitas} visita{c._count.visitas !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="ml-3 text-xs text-text-muted">{formatDate(c.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Actividad completa ({data.timeline.length})
          </h3>
        </div>
        {data.timeline.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-faint">
            Sin actividad en este período
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data.timeline.map((item, i) => (
              <div
                key={`${item.kind}-${i}`}
                className={`flex items-start gap-3 px-5 py-3 ${TIMELINE_COLORS[item.kind] ?? ""}`}
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {TIMELINE_LABELS[item.kind] ?? item.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    <span className="font-medium">{item.entity}</span>
                    {item.description && (
                      <span className="text-text-muted">
                        {" · "}
                        {item.description.length > 120 ? item.description.slice(0, 120) + "..." : item.description}
                      </span>
                    )}
                  </p>
                  {item.type !== "estado" && (
                    <p className="text-xs capitalize text-text-faint">{item.type}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{formatDateTime(item.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
