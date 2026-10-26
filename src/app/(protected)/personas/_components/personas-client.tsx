"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Spinner } from "../../_components/spinner";

interface Source {
  sourceKey: string;
  status: "pending" | "running" | "human_required" | "ok" | "failed";
  summary?: string | null;
  data?: unknown;
  updatedAt?: string;
}
interface Report {
  id: string;
  identifier: string;
  kind: "cuit" | "dni";
  label: string | null;
  createdAt: string;
  sources: Source[];
}
interface SourceInfo { key: string; name: string; org?: string | null }

const POLL_MS = 3500;

function prettyId(value: string, kind: "cuit" | "dni"): string {
  if (!/^\d+$/.test(value)) return value;
  if (kind === "cuit") return `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}`;
  return Number(value).toLocaleString("es-AR");
}

const STATUS: Record<Source["status"], { label: string; cls: string; spin?: boolean }> = {
  ok: { label: "Listo", cls: "bg-sage-chip text-olive-light" },
  running: { label: "Consultando…", cls: "bg-info-chip text-info", spin: true },
  pending: { label: "En cola…", cls: "bg-info-chip text-info", spin: true },
  human_required: { label: "Requiere revisión", cls: "bg-sand-chip text-warning" },
  failed: { label: "Sin respuesta", cls: "bg-bg text-text-faint" },
};

export function PersonasClient({ configured }: { configured: boolean }) {
  const presetId = useSearchParams().get("id");
  const [identifier, setIdentifier] = useState("");
  const [starting, setStarting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [polling, setPolling] = useState(false);
  const [labels, setLabels] = useState<Record<string, SourceInfo>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetch("/api/personas/sources")
      .then((r) => r.json())
      .then((b) => {
        const map: Record<string, SourceInfo> = {};
        for (const s of (b?.data ?? []) as SourceInfo[]) map[s.key] = s;
        setLabels(map);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const done = useCallback((r: Report) => r.sources.every((s) => s.status !== "pending" && s.status !== "running"), []);

  const poll = useCallback(
    (id: string) => {
      timer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/personas/${id}`);
          const body = await res.json();
          if (!alive.current) return;
          if (res.ok && body.data) {
            setReport(body.data);
            if (done(body.data)) {
              setPolling(false);
              return;
            }
          }
        } catch {
          /* reintenta en el próximo tick */
        }
        if (alive.current) poll(id);
      }, POLL_MS);
    },
    [done],
  );

  // Reabrir un informe desde el historial (/personas?id=...).
  const abrirExistente = useCallback(
    async (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      setReport(null);
      setPolling(true);
      try {
        const res = await fetch(`/api/personas/${id}`);
        const body = await res.json();
        if (!alive.current) return;
        if (res.ok && body.data) {
          setReport(body.data);
          if (done(body.data)) setPolling(false);
          else poll(id);
        } else {
          setPolling(false);
          toast.error(body.message ?? "No se pudo abrir el informe.");
        }
      } catch {
        if (alive.current) {
          setPolling(false);
          toast.error("Error de conexión.");
        }
      }
    },
    [done, poll],
  );

  useEffect(() => {
    if (presetId) void abrirExistente(presetId);
  }, [presetId, abrirExistente]);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!id || starting) return;
    if (timer.current) clearTimeout(timer.current);
    setStarting(true);
    setReport(null);
    setPolling(false);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo iniciar la consulta.");
        return;
      }
      setReport(body.data);
      if (!done(body.data)) {
        setPolling(true);
        poll(body.data.id);
      }
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setStarting(false);
    }
  }

  const okCount = report ? report.sources.filter((s) => s.status === "ok").length : 0;
  const total = report ? report.sources.length : 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Personas</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Informe de una persona por CUIT, CUIL o DNI. Buscamos en registros públicos y oficiales.
          </p>
        </div>
        <Link
          href="/personas/historial"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg"
        >
          Historial
        </Link>
      </div>

      {!configured && (
        <div className="mb-5 rounded-[18px] border border-border bg-sand-chip/40 px-4 py-3 text-[13px] text-text-muted">
          La consulta de personas todavía no está habilitada en este entorno.
        </div>
      )}

      <form onSubmit={consultar} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-[12px] font-semibold text-text-muted">CUIT / CUIL / DNI</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            inputMode="numeric"
            placeholder="20-12345678-3 o 12345678"
            disabled={!configured || starting}
            className="h-11 w-full rounded-[14px] border border-border bg-surface px-4 text-[14px] text-text outline-none focus:border-text-muted disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={!configured || starting || !identifier.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-dark px-6 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {starting ? <><Spinner size={14} /> Consultando…</> : "Consultar"}
        </button>
      </form>

      {report && (
        <div className="space-y-4">
          {/* Cabecera del informe */}
          <div className="rounded-[18px] border border-border bg-surface px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[18px] font-semibold text-text">
                  {report.label ?? "Informe de persona"}
                </p>
                <p className="mt-0.5 text-[12.5px] text-text-faint">
                  {report.kind === "cuit" ? "CUIT/CUIL" : "DNI"} {prettyId(report.identifier, report.kind)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-text-muted">
                {polling && <Spinner size={14} />}
                <span>{okCount}/{total} fuentes</span>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-olive-deep transition-all"
                style={{ width: total ? `${Math.round((okCount / total) * 100)}%` : "0%" }}
              />
            </div>
          </div>

          {/* Fuentes */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {report.sources.map((s) => (
                <SourceCard key={s.sourceKey} source={s} info={labels[s.sourceKey]} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, info }: { source: Source; info?: SourceInfo }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[source.status];
  const name = info?.name ?? source.sourceKey.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const hasDetail = source.status === "ok" && source.data != null && typeof source.data === "object" && Object.keys(source.data as object).length > 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 rounded-[18px] border border-border bg-surface px-4 py-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold text-text">{name}</p>
          {info?.org && <p className="truncate text-[11.5px] text-text-faint">{info.org}</p>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>
          {st.spin && <Spinner size={10} />}
          {st.label}
        </span>
      </div>
      {source.summary && <p className="text-[12.5px] leading-snug text-text-muted">{source.summary}</p>}
      {hasDetail && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11.5px] font-semibold text-text-faint underline-offset-2 hover:underline"
          >
            {open ? "Ocultar detalle" : "Ver detalle"}
          </button>
          {open && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-[12px] bg-bg px-3 py-2 text-[11px] leading-relaxed text-text-muted">
              {JSON.stringify(source.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </motion.div>
  );
}
