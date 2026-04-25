"use client";

import { motion } from "framer-motion";
import type { AggregateKPIs } from "@/lib/objectives";

interface KPIStripProps {
  kpis: AggregateKPIs;
  periodLabel: string;
}

const cardClass =
  "flex flex-col gap-1 rounded-2xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:border-border-strong";

export function KPIStrip({ kpis, periodLabel }: Readonly<KPIStripProps>) {
  const items = [
    {
      label: "Total objetivos",
      value: kpis.totalCards.toString(),
      hint: periodLabel,
      tone: "text-text",
    },
    {
      label: "% cumplimiento",
      value: `${kpis.globalPercent}%`,
      hint: "ítems cumplidos / total",
      tone: "text-accent",
    },
    {
      label: "En curso",
      value: kpis.inProgress.toString(),
      hint: `${kpis.pending} pendientes`,
      tone: "text-olive-light",
    },
    {
      label: "Finalizados",
      value: kpis.completed.toString(),
      hint: kpis.totalCards > 0 ? `${Math.round((kpis.completed / kpis.totalCards) * 100)}% del total` : "—",
      tone: "text-emerald-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          className={cardClass}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {item.label}
          </p>
          <p className={`font-display text-2xl leading-none md:text-3xl ${item.tone}`}>
            {item.value}
          </p>
          <p className="text-[11px] text-text-faint">{item.hint}</p>
        </motion.div>
      ))}
    </div>
  );
}
