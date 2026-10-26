"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Spinner } from "../../../_components/spinner";
import { Pagination } from "../../../_components/pagination";
import { formatDate } from "@/lib/datetime";

interface Item {
  id: string;
  identifier: string;
  kind: "cuit" | "dni";
  buscalaReportId: string;
  label: string | null;
  createdAt: string;
  author: string | null;
}

interface Props {
  items: Item[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

function prettyId(value: string, kind: "cuit" | "dni"): string {
  if (!/^\d+$/.test(value)) return value;
  if (kind === "cuit") return `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}`;
  return Number(value).toLocaleString("es-AR");
}

export function HistorialClient({ items, page, totalPages, total, limit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function borrar(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/personas/history/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? "No se pudo borrar.");
        return;
      }
      toast.success("Consulta borrada del historial");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Historial de personas</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            {total} consulta{total !== 1 ? "s" : ""} hecha{total !== 1 ? "s" : ""} desde Profitos
          </p>
        </div>
        <Link
          href="/personas"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90"
        >
          <span className="text-accent">+</span> Nueva consulta
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-surface px-5 py-10 text-center text-[13.5px] text-text-faint">
          Todavía no hay consultas. Empezá desde <Link href="/personas" className="font-semibold text-text-muted underline">Nueva consulta</Link>.
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-2 ${isPending ? "opacity-60" : ""}`}>
          <AnimatePresence mode="popLayout">
            {items.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-text">{it.label ?? prettyId(it.identifier, it.kind)}</p>
                  <p className="truncate text-[11.5px] text-text-faint">
                    {it.kind === "cuit" ? "CUIT/CUIL" : "DNI"} {prettyId(it.identifier, it.kind)} · {formatDate(it.createdAt)}
                    {it.author ? ` · ${it.author}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/personas?id=${encodeURIComponent(it.buscalaReportId)}`}
                    className="inline-flex h-8 items-center rounded-full bg-sage-chip px-3.5 text-[12px] font-bold text-olive-light transition-opacity hover:opacity-80"
                  >
                    Abrir
                  </Link>
                  <button
                    onClick={() => borrar(it.id)}
                    disabled={deletingId === it.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80 disabled:opacity-50"
                    title="Borrar del historial"
                  >
                    {deletingId === it.id ? (
                      <Spinner variant="red" size={12} />
                    ) : (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 4h11M6.5 4V2.5h3V4M5 4v9.5h6V4M6.8 6.5v4.5M9.2 6.5v4.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} startTransition={startTransition} />
      </div>
    </div>
  );
}
