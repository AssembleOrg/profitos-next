"use client";

import { motion } from "framer-motion";
import type { AggregateKPIs } from "@/lib/objectives";

interface KPIStripProps {
  kpis: AggregateKPIs;
  periodLabel: string;
}

const cardClass = "flex flex-col gap-1 rounded-[18px] px-3.5 py-2.5";

export function KPIStrip({ kpis, periodLabel }: Readonly<KPIStripProps>) {
  const items = [
    {
      label: "Total objetivos",
      value: kpis.totalCards.toString(),
      hint: periodLabel,
      tone: "text-text",
      surface: "border border-border bg-surface",
    },
    {
      label: "% cumplimiento",
      value: `${kpis.globalPercent}%`,
      hint: "ítems cumplidos / total",
      tone: "text-olive-light",
      surface: "bg-sage-chip",
    },
    {
      label: "En curso",
      value: kpis.inProgress.toString(),
      hint: `${kpis.pending} pendientes`,
      tone: "text-info",
      surface: "bg-info-chip",
    },
    {
      label: "Finalizados",
      value: kpis.completed.toString(),
      hint: kpis.totalCards > 0 ? `${Math.round((kpis.completed / kpis.totalCards) * 100)}% del total` : "—",
      tone: "text-warning",
      surface: "bg-sand-chip",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          className={`${cardClass} ${item.surface}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
            {item.label}
          </p>
          <p className={`font-display text-xl font-bold leading-none md:text-2xl ${item.tone}`}>
            {item.value}
          </p>
          <p className="text-[11px] text-text-faint">{item.hint}</p>
        </motion.div>
      ))}
    </div>
  );
}
